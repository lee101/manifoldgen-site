# Video background remover adapter

The GPU runtime has moved to `omniserve-native`:

- workload: `../omniserve-native/workloads/video_matting.py`
- generic dispatcher: `../omniserve-native/runtime/handler.py`
- RunPod deployment: `../omniserve-native/scripts/deploy-runpod.sh`

Manifold owns only the product boundary: durable request identity, billing,
presigned object upload, private-provider circuit breaking, and FAL standby.
It submits the explicit `video-matting` OmniServe workload.

`scripts/deploy-video-background-runpod.sh` remains as a compatibility wrapper.
Set `OMNISERVE_NATIVE_ROOT` when the repositories are not adjacent.

RVM is a GPL-3.0 research backend. Confirm licensing/compliance or replace the
plugin before offering it as a commercial service.
