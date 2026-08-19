# Image Editor RunPod worker

Build `workers/image-editor` as a RunPod serverless image, attach a shared volume at `/runpod-volume`, and use a 24 GB or larger GPU. Set the R2 variables described at the top of `handler.py` so masks and results are durable public URLs.

Expose the RunPod endpoint through a small authenticated HTTP adapter that accepts the native gateway contracts below and invokes the RunPod `runsync` API:

- `POST /v1/images/segmentations` → `{ "input": { "mode": "segment", "image_url": "...", "points": [...] } }`
- `POST /v1/images/text-layers` → `{ "input": { "mode": "text", "image_url": "...", "box": { "x": 0, "y": 0, "width": 1, "height": 1 } } }`
- `POST /v1/images/edits` → `{ "input": { "mode": "edit", "image_url": "...", "mask_url": "...", "prompt": "..." } }`

Configure that adapter as `OMNISERVE_NATIVE_IMAGE_EDITOR_UPSTREAM`; the native gateway forwards both paths with its normal authentication and admission controls. The local 5090 remains reserved for interactive Z-Image and BiRefNet work.
