"""Persistent VideoX-Fun MiniMax H3 ControlNet Union runtime."""

from __future__ import annotations

import os
import random
import tempfile
from pathlib import Path

class H3ControlRuntime:
    def __init__(self, model_dir: str | None = None, control_dir: str | None = None):
        import torch
        from omegaconf import OmegaConf
        from safetensors.torch import load_file
        from videox_fun.dist import set_multi_gpus_devices
        from videox_fun.models import (AutoencoderKLMiniMaxH3, AutoencoderKLMiniMaxH3Audio, MiniMaxH3ControlTransformer3DModel, Qwen2TokenizerFast, Qwen3VLForConditionalGeneration, Qwen3VLProcessor)
        from videox_fun.pipeline import MiniMaxH3ControlPipeline
        from videox_fun.utils import MiniMaxH3Scheduler, register_auto_device_hook
        from videox_fun.utils.group_offload import (apply_group_offloading,
                                                    _patch_group_offload_device_anchors)

        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True
        self.device = set_multi_gpus_devices(1, 1)
        self.dtype = torch.bfloat16
        self.model_dir = Path(model_dir or os.environ.get("H3_MODEL_DIR", "/runpod-volume/models/minimax-h3"))
        self.control_dir = Path(control_dir or os.environ.get("H3_CONTROL_DIR", "/runpod-volume/models/minimax-h3-control"))
        self._ensure_models()
        config = OmegaConf.load("/opt/VideoX-Fun/config/minimax_h3/minimax_h3_control.yaml")
        kwargs = OmegaConf.to_container(config["transformer_additional_kwargs"], resolve=True)
        transformer = MiniMaxH3ControlTransformer3DModel.from_pretrained(
            str(self.model_dir), subfolder="transformer", low_cpu_mem_usage=True,
            torch_dtype=self.dtype, **kwargs,
        )
        state = load_file(str(self.control_dir / "MiniMax-H3-Fun-Controlnet-Union.safetensors"))
        missing, unexpected = transformer.load_state_dict(state, strict=False)
        control_missing = [name for name in missing if name.startswith(("control_", "control_blocks"))]
        if control_missing or unexpected:
            raise RuntimeError(f"control checkpoint mismatch: missing={len(control_missing)} unexpected={len(unexpected)}")
        vae = AutoencoderKLMiniMaxH3.from_pretrained(str(self.model_dir), subfolder="vae", low_cpu_mem_usage=True, torch_dtype=self.dtype)
        audio_vae = AutoencoderKLMiniMaxH3Audio.from_pretrained(str(self.model_dir), subfolder="audio_vae", low_cpu_mem_usage=True, torch_dtype=self.dtype)
        tokenizer = Qwen2TokenizerFast.from_pretrained(self.model_dir / "tokenizer")
        processor = Qwen3VLProcessor.from_pretrained(self.model_dir / "processor")
        text_encoder = Qwen3VLForConditionalGeneration.from_pretrained(self.model_dir / "text_encoder", low_cpu_mem_usage=True, torch_dtype=self.dtype).eval()
        scheduler = MiniMaxH3Scheduler.from_pretrained(str(self.model_dir), subfolder="scheduler")
        audio_scheduler = MiniMaxH3Scheduler.from_pretrained(str(self.model_dir), subfolder="audio_scheduler")
        self.pipeline = MiniMaxH3ControlPipeline(vae=vae, audio_vae=audio_vae, text_encoder=text_encoder, tokenizer=tokenizer, processor=processor, transformer=transformer, scheduler=scheduler, audio_scheduler=audio_scheduler)
        register_auto_device_hook(self.pipeline.transformer)
        # Leaf hooks are required for Qwen's embedding and rotary buffers and are
        # already proven with this pipeline. Replace only the huge transformer's
        # leaf hooks with block streaming; that is where nearly all denoising-time
        # CPU/GPU synchronization occurs.
        for name, component in (("video VAE", self.pipeline.vae), ("audio VAE", self.pipeline.audio_vae),
                                ("text encoder", self.pipeline.text_encoder)):
            print(f"Installing leaf offload for {name}...", flush=True)
            apply_group_offloading(
                component,
                onload_device=self.device,
                offload_device="cpu",
                offload_type="leaf_level",
                use_stream=False,
                low_cpu_mem_usage=True,
            )
        print("Installing streamed block offload for H3 transformer...", flush=True)
        apply_group_offloading(
            self.pipeline.transformer,
            onload_device=self.device,
            offload_device="cpu",
            offload_type="block_level",
            num_blocks_per_group=1,
            use_stream=True,
            low_cpu_mem_usage=True,
        )
        print("H3 offload runtime ready.", flush=True)
        # Group offload uses its own hooks rather than Accelerate's, so a stock
        # DiffusionPipeline otherwise mistakes the all-CPU resting weights for
        # its execution device. Avoid a full transformer CUDA round-trip solely
        # to make the pipeline helper install this property.
        execution_device = torch.device(self.device)
        self.pipeline.__class__._execution_device = property(lambda _: execution_device)
        _patch_group_offload_device_anchors(self.pipeline)

    def _ensure_models(self):
        from huggingface_hub import snapshot_download

        marker = self.model_dir / "transformer" / "diffusion_pytorch_model.safetensors.index.json"
        if not marker.exists():
            self.model_dir.mkdir(parents=True, exist_ok=True)
            snapshot_download("MiniMaxAI/MiniMax-H3", local_dir=self.model_dir, allow_patterns=["transformer/*", "vae/*", "audio_vae/*", "text_encoder/*", "tokenizer/*", "processor/*", "scheduler/*", "audio_scheduler/*", "model_index.json"])
        checkpoint = self.control_dir / "MiniMax-H3-Fun-Controlnet-Union.safetensors"
        if not checkpoint.exists():
            self.control_dir.mkdir(parents=True, exist_ok=True)
            snapshot_download("alibaba-pai/MiniMax-H3-Fun-Controlnet-Union", local_dir=self.control_dir, allow_patterns=["*.safetensors", "configuration.json", "LICENSE", "NOTICE"])

    @staticmethod
    def dimensions(resolution: str) -> list[int]:
        return {"480p": [480, 864], "576p": [576, 1024], "720p": [704, 1280]}[resolution]

    @staticmethod
    def snap_frames(actual: int, maximum: int) -> int:
        count = min(actual, maximum)
        return max((count - 5) // 17 * 17 + 5, 5)

    def generate(self, *, control_video: Path, prompt: str, resolution: str, duration: int,
                 steps: int, control_scale: float, seed: int | None = None,
                 negative_prompt: str = "", inpaint_video: Path | None = None,
                 mask_video: Path | None = None) -> Path:
        import torch
        from videox_fun.utils.utils import get_video_to_video_latent, save_videos_with_audio_grid
        size = self.dimensions(resolution)
        maximum = min(243, duration * 24)
        control, _, _, _ = get_video_to_video_latent(str(control_video), video_length=maximum, sample_size=size, fps=24, ref_image=None, keep_aspect_ratio=True)
        frames = self.snap_frames(control.shape[2], maximum)
        source_latent = mask_latent = None
        if inpaint_video is not None:
            if mask_video is None:
                raise ValueError("inpainting requires a mask")
            source_latent, _, _, _ = get_video_to_video_latent(str(inpaint_video), video_length=maximum, sample_size=size, fps=24, ref_image=None, keep_aspect_ratio=True)
            raw_mask, _, _, _ = get_video_to_video_latent(str(mask_video), video_length=maximum, sample_size=size, fps=24, ref_image=None, keep_aspect_ratio=True)
            mask_latent = (raw_mask[:, :1] > 0.5).to(raw_mask.dtype)
        generator = torch.Generator(device=self.device).manual_seed(seed if seed is not None else random.randint(0, 2**31 - 1))
        with torch.inference_mode():
            output = self.pipeline(prompt=prompt, control_video=control, control_context_scale=control_scale,
                mask_video=mask_latent, inpaint_video=source_latent, height=size[0], width=size[1],
                num_frames=frames, num_inference_steps=steps, guidance_scale=1.0,
                negative_prompt=negative_prompt, generator=generator, output_type="pt")
        descriptor, filename = tempfile.mkstemp(prefix="h3-control-output-", suffix=".mp4")
        os.close(descriptor)
        path = Path(filename)
        save_videos_with_audio_grid(output.videos, output.audio, str(path), fps=24, audio_sample_rate=output.sampling_rate)
        return path
