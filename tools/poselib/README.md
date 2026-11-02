# poselib

Pose library behind `/tools/pose-library` and `/tools/pose-puppet` (manifoldgen) and the same tools on ebank.nz (netwrck).
Records are one pose with up to five camera views plus depth and skeleton maps. Search is gobed (semantic) blended with
keyword overlap; `server/poselib.go` falls back to keyword-only until the index is ready (always in light dev mode).

## Sources

- **shisei** (CC0, github.com/wquguru/shisei): 280 poses x 5 angles of line art. Suggestive series are flagged `nsfw` and
  hidden unless the user opted in (`allow_nsfw=true`, same gate as the gallery). Depth maps come from Depth Anything V2 small.
- **generated**: poses sampled by `frontend/lib/pose-studio/sampler.ts` (12 base postures x 19 arm gestures x jitter),
  nine body types (`bodies.ts`: genman, genwoman, tall/stocky man, slim/short/curvy woman, teen boy/girl), rendered by the
  3D studio itself, so mesh, depth and OpenPose skeleton are exact. 400 solo (5 views), 60 duos, 20 trios.
  Descriptions are built from the sampled parameters, so the search text matches what is drawn.

## Rebuild

    git clone --depth 1 https://github.com/wquguru/shisei /tmp/shisei
    cd tools/poselib
    uv run poselib import-shisei /tmp/shisei
    HF_HUB_OFFLINE=1 uv run poselib depth
    cd ../../frontend && bun pose-studio-standalone/build.ts
    bun scripts/render-pose-library.ts --solo 400 --duo 60 --trio 20 --seed 1000   # ~20 min, swiftshader
    cd ../tools/poselib && uv run poselib build                                     # PNG -> webp, writes data/manifest.json

`data/` is not in git (about 130 MB). Server reads `POSELIB_DIR` (default `tools/poselib/data`); set `POSELIB_CDN` to serve
images from the static bucket instead of `/pose-assets/`.

## netwrck / ebank.nz

Copy `data/manifest.json` and `data/images` to `netwrck/static/poselib/` (ignored by git, like `static/vn/catalog`), copy
`frontend/public/pose-studio/pose-studio.{js,css}` to `static/libs/anime-pose-editor/` (bump `?v=` in
`templates/tools/anime-control.pongo` when the bundle changes), and `bun build.js tool:anime-control`.
`/tools/pose-puppet` reuses the anime scene tool template with `data-puppet=1`.
