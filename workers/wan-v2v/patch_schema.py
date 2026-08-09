"""Patch the base Cog's baked OpenAPI input schema for the V2V predictor."""

import json
from pathlib import Path


schema_path = Path("/src/.cog/openapi_schema.json")
schema = json.loads(schema_path.read_text())
input_schema = schema["components"]["schemas"]["Input"]
input_schema["properties"] = {
    "video_url": {"description": "Source MP4, MOV, or WebM video", "format": "uri", "title": "Video Url", "type": "string", "x-order": 0},
    "prompt": {"description": "Text prompt describing the transformed video", "title": "Prompt", "type": "string", "x-order": 1},
    "negative_prompt": {"title": "Negative Prompt", "type": "string", "x-order": 2},
    "strength": {"default": 0.9, "minimum": 0.05, "maximum": 1.0, "title": "Strength", "type": "number", "x-order": 3},
    "num_frames": {"default": 81, "minimum": 17, "maximum": 161, "title": "Num Frames", "type": "integer", "x-order": 4},
    "frames_per_second": {"default": 16, "minimum": 4, "maximum": 60, "title": "Frames Per Second", "type": "integer", "x-order": 5},
    "resolution": {"default": "720p", "enum": ["480p", "580p", "720p"], "title": "Resolution", "type": "string", "x-order": 6},
    "aspect_ratio": {"default": "auto", "enum": ["auto", "16:9", "9:16", "1:1"], "title": "Aspect Ratio", "type": "string", "x-order": 7},
    "num_inference_steps": {"default": 27, "minimum": 4, "maximum": 50, "title": "Num Inference Steps", "type": "integer", "x-order": 8},
    "guidance_scale": {"default": 3.5, "minimum": 1.0, "maximum": 20.0, "title": "Guidance Scale", "type": "number", "x-order": 9},
    "seed": {"title": "Seed", "type": "integer", "x-order": 10},
    "cgtaylor": {"default": True, "description": "Confidence-gated Taylor acceleration", "title": "Cgtaylor", "type": "boolean", "x-order": 11},
    "cgtaylor_threshold": {"default": 0.04, "minimum": 0.001, "maximum": 1.0, "title": "Cgtaylor Threshold", "type": "number", "x-order": 12},
}
input_schema["required"] = ["video_url", "prompt"]
schema_path.write_text(json.dumps(schema, separators=(",", ":")))
