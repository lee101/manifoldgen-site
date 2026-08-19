"""RunPod worker for precise object masks (SAM 2.1) and targeted SDXL inpainting.

The worker intentionally loads SAM and SDXL one at a time. That keeps the pool
deployable on economical 24 GB GPUs while retaining a quality segmentation model.
Set R2_ENDPOINT_URL, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and
R2_PUBLIC_BASE_URL to return durable public URLs. Without R2 it returns data URLs,
which is useful for development but not recommended for production responses.
"""

import base64
import io
import os
import uuid

import requests
import runpod
import torch
from PIL import Image, ImageOps

SAM_CHECKPOINT = os.getenv("SAM2_CHECKPOINT", "facebook/sam2.1-hiera-small")
INPAINT_CHECKPOINT = os.getenv("INPAINT_CHECKPOINT", "diffusers/stable-diffusion-xl-1.0-inpainting-0.1")
MAX_EDGE = int(os.getenv("IMAGE_EDITOR_MAX_EDGE", "1536"))
_sam = None
_inpaint = None


def _read(url):
    if not isinstance(url, str) or not url:
        raise ValueError("a public image URL is required")
    if url.startswith("data:"):
        encoded = url.split(",", 1)[-1]
        return ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(encoded)))).convert("RGB")
    response = requests.get(url, timeout=(10, 60))
    response.raise_for_status()
    return ImageOps.exif_transpose(Image.open(io.BytesIO(response.content))).convert("RGB")


def _fit(image):
    width, height = image.size
    factor = min(1, MAX_EDGE / max(width, height))
    width, height = max(8, int(width * factor) // 8 * 8), max(8, int(height * factor) // 8 * 8)
    return image.resize((width, height), Image.Resampling.LANCZOS)


def _publish(image, name, fmt="PNG"):
    buffer = io.BytesIO()
    image.save(buffer, format=fmt, optimize=True)
    payload = buffer.getvalue()
    base = os.getenv("R2_PUBLIC_BASE_URL", "").rstrip("/")
    bucket = os.getenv("R2_BUCKET", "")
    endpoint = os.getenv("R2_ENDPOINT_URL", "")
    if base and bucket and endpoint:
        import boto3
        key = f"image-editor/{uuid.uuid4().hex}-{name.lower()}"
        client = boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=os.environ.get("R2_ACCESS_KEY_ID"), aws_secret_access_key=os.environ.get("R2_SECRET_ACCESS_KEY"))
        content_type = "image/png" if fmt == "PNG" else "image/webp"
        client.put_object(Bucket=bucket, Key=key, Body=payload, ContentType=content_type)
        return f"{base}/{key}"
    return "data:image/png;base64," + base64.b64encode(payload).decode("ascii")


def _unload_inpaint():
    global _inpaint
    if _inpaint is not None:
        del _inpaint
        _inpaint = None
        torch.cuda.empty_cache()


def _sam_predictor():
    global _sam
    if _sam is None:
        from sam2.sam2_image_predictor import SAM2ImagePredictor
        _sam = SAM2ImagePredictor.from_pretrained(SAM_CHECKPOINT)
    return _sam


def segment(inputs):
    _unload_inpaint()
    image = _read(inputs.get("image_url"))
    points = inputs.get("points") or []
    if not 1 <= len(points) <= 16:
        raise ValueError("between 1 and 16 selection points are required")
    predictor = _sam_predictor()
    import numpy as np
    predictor.set_image(np.asarray(image))
    coords, labels = [], []
    for point in points:
        x, y, label = float(point["x"]), float(point["y"]), int(point.get("label", 1))
        if not 0 <= x <= 1 or not 0 <= y <= 1 or label not in (0, 1):
            raise ValueError("selection points must use normalized coordinates and labels 0 or 1")
        coords.append([x * image.width, y * image.height]); labels.append(label)
    masks, scores, _ = predictor.predict(point_coords=np.asarray(coords), point_labels=np.asarray(labels), multimask_output=True)
    mask = Image.fromarray((masks[int(scores.argmax())] * 255).astype("uint8"), mode="L")
    cutout = image.convert("RGBA"); cutout.putalpha(mask)
    return {"mask_url": _publish(mask, "mask.png"), "cutout_url": _publish(cutout, "cutout.png"), "width": image.width, "height": image.height}


def _pipeline():
    global _inpaint
    if _inpaint is None:
        from diffusers import AutoPipelineForInpainting
        _inpaint = AutoPipelineForInpainting.from_pretrained(INPAINT_CHECKPOINT, torch_dtype=torch.float16, variant="fp16", use_safetensors=True).to("cuda")
        _inpaint.enable_attention_slicing()
        _inpaint.enable_vae_tiling()
    return _inpaint


def edit(inputs):
    image = _read(inputs.get("image_url")); mask = _read(inputs.get("mask_url")).convert("L")
    prompt = str(inputs.get("prompt", "")).strip()
    if not prompt: raise ValueError("a replacement prompt is required")
    original_size = image.size
    image = _fit(image); mask = mask.resize(image.size, Image.Resampling.NEAREST)
    result = _pipeline()(prompt=prompt, image=image, mask_image=mask, num_inference_steps=int(inputs.get("steps", 28)), guidance_scale=float(inputs.get("guidance", 6.5))).images[0]
    if result.size != original_size: result = result.resize(original_size, Image.Resampling.LANCZOS)
    return {"image_url": _publish(result, "edit.png"), "width": original_size[0], "height": original_size[1]}


def text_layer(inputs):
    """Read one user-drawn text region and return an editable layer plus erase mask.

    Deliberately keeping detection inside the selected box makes OCR far more
    reliable on posters and screenshots than asking a general detector to guess
    which of several text blocks the user intends to move.
    """
    import numpy as np
    import pytesseract
    from PIL import ImageDraw

    image = _read(inputs.get("image_url"))
    raw_box = inputs.get("box") or {}
    x, y = float(raw_box.get("x", 0)), float(raw_box.get("y", 0))
    w, h = float(raw_box.get("width", 0)), float(raw_box.get("height", 0))
    if x < 0 or y < 0 or w <= 0 or h <= 0 or x + w > 1 or y + h > 1:
        raise ValueError("draw a text box within the image")
    left, top = round(x * image.width), round(y * image.height)
    right, bottom = round((x + w) * image.width), round((y + h) * image.height)
    crop = image.crop((left, top, right, bottom))
    scale = max(1, min(4, 1200 // max(1, crop.height)))
    enlarged = crop.resize((crop.width * scale, crop.height * scale), Image.Resampling.LANCZOS)
    data = pytesseract.image_to_data(enlarged, output_type=pytesseract.Output.DICT, config="--psm 6")
    words, boxes = [], []
    for index, value in enumerate(data["text"]):
        value = (value or "").strip()
        try: confidence = float(data["conf"][index])
        except (TypeError, ValueError): confidence = -1
        if not value or confidence < 20: continue
        bx, by = data["left"][index] / scale, data["top"][index] / scale
        bw, bh = data["width"][index] / scale, data["height"][index] / scale
        words.append(value); boxes.append((bx, by, bw, bh))
    if not words:
        raise ValueError("no readable text found in that box")
    min_x, min_y = min(b[0] for b in boxes), min(b[1] for b in boxes)
    max_x = max(b[0] + b[2] for b in boxes), max(b[1] + b[3] for b in boxes)
    padding = max(2, round(max(b[3] for b in boxes) * 0.12))
    mask = Image.new("L", image.size, 0); draw = ImageDraw.Draw(mask)
    for bx, by, bw, bh in boxes:
        draw.rectangle((left + bx - padding, top + by - padding, left + bx + bw + padding, top + by + bh + padding), fill=255)
    pixels = np.asarray(crop.convert("RGB"), dtype=np.float32)
    edge = np.concatenate((pixels[:2].reshape(-1, 3), pixels[-2:].reshape(-1, 3), pixels[:, :2].reshape(-1, 3), pixels[:, -2:].reshape(-1, 3)))
    backdrop = np.median(edge, axis=0)
    contrast = np.linalg.norm(pixels - backdrop, axis=2)
    ink = pixels[contrast >= np.percentile(contrast, 72)]
    colour = np.median(ink if len(ink) else pixels.reshape(-1, 3), axis=0).astype(int)
    average_height = sum(b[3] for b in boxes) / len(boxes)
    return {
        "text": " ".join(words), "mask_url": _publish(mask, "text-mask.png"),
        "box": {"x": (left + min_x) / image.width, "y": (top + min_y) / image.height,
                "width": (max_x - min_x) / image.width, "height": (max_y - min_y) / image.height},
        "font_size": max(10, round(average_height * 0.84)), "font_family": "Arial, Helvetica, sans-serif",
        "font_weight": 700 if average_height > 26 else 500,
        "font_style": "normal", "color": "#%02x%02x%02x" % tuple(colour),
    }


def handler(job):
    inputs = (job.get("input") or {}).get("input", job.get("input") or {})
    mode = inputs.get("mode")
    if mode == "segment": return segment(inputs)
    if mode == "text": return text_layer(inputs)
    if mode == "edit": return edit(inputs)
    raise ValueError("mode must be segment or edit")


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
