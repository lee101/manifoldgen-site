# RunPod idle-cost audit — 14 September 2026

RunPod hourly billing for 05:00–07:00 UTC showed approximately $0.3523/hour
for `cog-pixal3d-33efd92a` (`8lawkbhewkm81g`) and $0.078944/hour for network
storage. Serverless billing for 05:00–08:00 UTC was empty. The combined baseline
was approximately $0.4313/hour ($310.54 per 30-day month).

The Pixal3D model was in `error`, with an unreachable endpoint and no queued,
starting, or processing predictions. Its last use was September 9; recent
predictions had all failed. RunPod reported 0% GPU and memory utilization.
After rechecking active jobs, the pod was terminated and the app database was
updated only after RunPod confirmed deletion. Its approximately $253.70/month
baseline is removed. Flex endpoint capacity remains available with minimum
workers zero; the Pixal3D endpoint idle timeout was reduced to five seconds.

## Root cause and safeguards

The app.nz Cog idle reaper selected only `ready` models. Error-state models
retained their paid backing pod indefinitely. Cleanup now includes errors,
protects queued/starting/processing jobs, and preserves the provider handle
when deletion fails so subsequent sweeps retry. Provider deletion must succeed
before an instance is recorded as terminated.

The ManifoldGen guard now reports all running direct pods and network volumes,
flags non-scratch pods older than 24 hours, and rejects incomplete queue health
instead of interpreting missing fields as an empty queue. This inventory does
not authorize automatic deletion of production data.

## Remaining persistent storage

| Volume | ID | Allocated GB | Region |
| --- | --- | ---: | --- |
| Shared video models | `5rc1bmt70a` | 256 | US-IL-1 |
| Wan Blackwell cache | `fb96eh7ozc` | 100 | US-CA-2 |
| H3 control models | `gz226u7mrl` | 256 | CA-MTL-3 |
| Music3 models | `r2died41lj` | 100 | US-NC-1 |

The billing API reports 612 GB ordinary storage ($0.0595/hour) plus 100 GB
high-performance storage ($0.019444/hour), approximately $56.84/month total.
These charges persist with no running GPU. Allocated capacity is not a file
inventory: the contents and actual used bytes have not yet been verified.

[R2 Standard storage](https://developers.cloudflare.com/r2/pricing/) is
$0.015/GB-month plus operations, with no Internet egress charge. Storing 712 GB
would be $10.68/month before free allowances and operation charges; actual
migration cost depends on used bytes. R2 does not replace a mounted filesystem:
workers must download/cache model files on demand, and cold-start behavior must
be verified before removing their network-volume attachment.

[RunPod's S3 API](https://docs.runpod.io/storage/s3-api) requires a separate S3
access key and secret, not the existing RunPod control-plane API key. No such
credentials were found in the configured project or production environments.
CA-MTL-3 is also absent from the documented S3-enabled datacenter list.

Safe migration sequence: provision scoped S3 access for the three supported
regions; inventory files and distinguish reproducible model caches from unique
artifacts; copy required data to a private R2 prefix with checksum manifests;
verify complete destination contents and a cold worker reading from R2; then
remove obsolete endpoint mounts and delete only the verified redundant volume.
The CA-MTL-3 volume requires a temporary mounted transfer worker or provider
support. No network volumes were deleted during this audit.

## Validation and deployment

The new Cog lifecycle tests cover failed cold starts, the idle window, active
jobs, and provider deletion failure followed by a successful retry. Focused
server tests and the race detector passed. Media validation benchmarks measured
384 ns/op, 144 B/op, and one allocation. Seven cost-guard unit tests passed.

Both production services were rebuilt and restarted with health checks passing.
Existing production checkout changes were preserved. The production app.nz Go
suite and ManifoldGen Go suite passed. The local app.nz release gate still has
five catalog failures (provider metadata, pricing, aliases, and fallback routes);
it is not a fully green local release gate.

Public health, gallery image retrieval, GEO, and MCP discovery passed (90 app.nz
tools and five ManifoldGen tools). Browser checks of Studio and the Cog sign-in
gate returned HTTP 200 with no JavaScript errors; screenshots were inspected.
These were read-only checks, not paid inference requests. After deployment, the
installed guard reported no direct pods, no errors, and 712 GB retained storage.
