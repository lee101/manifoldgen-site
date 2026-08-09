"""Wan 2.2 A14B video-to-video Cog layered on the shared accelerated image."""

import random
import tempfile

import numpy as np
import torch
from cog import BasePredictor, Input, Path
from PIL import Image as PILImage

from cgtaylor import setup_cgtaylor, tracker
from weights import ensure_weights


MODEL_REPO = "Wan-AI/Wan2.2-T2V-A14B-Diffusers"


DEFAULT_NEGATIVE = (
    "flicker, warped anatomy, inconsistent subject, text, watermark, overexposed, "
    "static, blurred details, worst quality, low quality, compression artifacts"
)


def _dimensions(resolution: str, aspect_ratio: str, source_width: int, source_height: int):
    short_edge = {"480p": 480, "580p": 576, "720p": 720}.get(resolution, 720)
    if aspect_ratio == "auto":
        ratio = source_width / max(1, source_height)
    elif aspect_ratio == "16:9":
        ratio = 16 / 9
    elif aspect_ratio == "9:16":
        ratio = 9 / 16
    else:
        ratio = 1
    if ratio >= 1:
        height = short_edge
        width = round(height * ratio)
    else:
        width = short_edge
        height = round(width / ratio)
    # Keep 720p inputs bounded and satisfy Wan VAE spatial constraints.
    scale = min(1.0, 1280 / max(width, height))
    width = max(16, int(width * scale) // 16 * 16)
    height = max(16, int(height * scale) // 16 * 16)
    return width, height


def _resize_center_crop(image: PILImage.Image, width: int, height: int):
    source_width, source_height = image.size
    if source_width / source_height > width / height:
        scaled_width, scaled_height = round(source_width * height / source_height), height
    else:
        scaled_width, scaled_height = width, round(source_height * width / source_width)
    image = image.resize((scaled_width, scaled_height), PILImage.Resampling.LANCZOS)
    left = (scaled_width - width) // 2
    top = (scaled_height - height) // 2
    return image.crop((left, top, left + width, top + height))


def _sample_frames(frames, requested: int):
    # Wan's temporal VAE expects 4k+1 frames.
    count = max(17, min(161, round((requested - 1) / 4) * 4 + 1))
    indices = np.linspace(0, max(0, len(frames) - 1), count).round().astype(int)
    return [frames[index].convert("RGB") for index in indices]


def _save_video(frames, fps: int):
    import av

    if frames.ndim == 5:
        frames = frames[0]
    if frames.shape[0] == 3:
        frames = frames.permute(1, 2, 3, 0)
    elif frames.shape[1] == 3:
        frames = frames.permute(0, 2, 3, 1)
    if frames.dtype != torch.uint8:
        frames = (frames.clamp(0, 1) * 255).to(torch.uint8)
    video = frames.detach().cpu().numpy()
    _, height, width, _ = video.shape
    output = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False).name
    container = av.open(output, "w")
    stream = container.add_stream("libx264", rate=fps)
    stream.width = width
    stream.height = height
    stream.pix_fmt = "yuv420p"
    stream.options = {"crf": "23", "preset": "faster"}
    for frame in video:
        for packet in stream.encode(av.VideoFrame.from_ndarray(frame, format="rgb24")):
            container.mux(packet)
    for packet in stream.encode():
        container.mux(packet)
    container.close()
    return output


class Predictor(BasePredictor):
    def setup(self):
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        torch.backends.cudnn.benchmark = True

        from diffusers import WanVideoToVideoPipeline
        from diffusers.quantizers import PipelineQuantizationConfig

        checkpoint = ensure_weights(MODEL_REPO)
        quantization = PipelineQuantizationConfig(
            quant_backend="bitsandbytes_4bit",
            quant_kwargs={
                "load_in_4bit": True,
                "bnb_4bit_compute_dtype": torch.bfloat16,
                "bnb_4bit_quant_type": "nf4",
            },
            components_to_quantize=["transformer", "transformer_2"],
        )
        self.pipeline = WanVideoToVideoPipeline.from_pretrained(
            str(checkpoint),
            torch_dtype=torch.bfloat16,
            quantization_config=quantization,
            use_safetensors=True,
            low_cpu_mem_usage=True,
        ).to("cuda")
        self.pipeline.enable_attention_slicing(slice_size="auto")
        if hasattr(self.pipeline, "enable_vae_slicing"):
            self.pipeline.enable_vae_slicing()

    def predict(
        self,
        video_url: Path = Input(description="Source MP4, MOV, or WebM video"),
        prompt: str = Input(description="Text prompt describing the transformed video"),
        negative_prompt: str = Input(default=DEFAULT_NEGATIVE),
        strength: float = Input(default=0.9, ge=0.05, le=1.0),
        num_frames: int = Input(default=81, ge=17, le=161),
        frames_per_second: int = Input(default=16, ge=4, le=60),
        resolution: str = Input(default="720p", choices=["480p", "580p", "720p"]),
        aspect_ratio: str = Input(default="auto", choices=["auto", "16:9", "9:16", "1:1"]),
        num_inference_steps: int = Input(default=27, ge=4, le=50),
        guidance_scale: float = Input(default=3.5, ge=1.0, le=20.0),
        seed: int = Input(default=None),
        cgtaylor: bool = Input(default=True, description="Confidence-gated Taylor acceleration"),
        cgtaylor_threshold: float = Input(default=0.04, ge=0.001, le=1.0),
    ) -> Path:
        from diffusers.utils import load_video

        source_frames = load_video(str(video_url))
        if not source_frames:
            raise ValueError("source video contains no decodable frames")
        frames = _sample_frames(source_frames, num_frames)
        width, height = _dimensions(resolution, aspect_ratio, *frames[0].size)
        frames = [_resize_center_crop(frame, width, height) for frame in frames]

        tracker.cgtaylor_enabled_for_current_request = cgtaylor
        if cgtaylor:
            setup_cgtaylor(self.pipeline, threshold=cgtaylor_threshold)
            tracker.reset()
            for name in ("transformer", "transformer_2"):
                transformer = getattr(self.pipeline, name, None)
                if transformer is not None and hasattr(transformer, "_cgtaylor_wrapper"):
                    transformer._cgtaylor_wrapper.reset_state()

        generator = torch.Generator(device="cuda").manual_seed(seed if seed is not None else random.randint(0, 1_000_000))
        with torch.inference_mode():
            output = self.pipeline(
                video=frames,
                prompt=prompt,
                negative_prompt=negative_prompt,
                height=height,
                width=width,
                strength=strength,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
                output_type="pt",
            ).frames[0]
        return Path(_save_video(output, frames_per_second))
