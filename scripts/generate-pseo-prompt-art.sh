#!/usr/bin/env bash
set -euo pipefail

# Reproducible local prompt studies. Start ../omniserve-native with an embedded
# diffusion checkpoint, then run this file from the manifoldgen-site checkout.
# Use PSEO_ART_ONLY=product-orbit to regenerate a single named study.
gateway="${OMNISERVE_NATIVE_URL:-http://127.0.0.1:8791}"
output_dir="${1:-frontend/public/pseo/prompts}"
only="${PSEO_ART_ONLY:-}"
mkdir -p "$output_dir"

generate() {
  local name="$1"
  local seed="$2"
  local prompt="$3"
  local size="${4:-1024x768}"
  local extra_negative="${5:-}"
  if [[ -n "$only" && "$only" != "$name" ]]; then return; fi
  local destination="$output_dir/$name.webp"
  local temporary="$destination.part"

  jq -n \
    --arg prompt "$prompt" \
    --arg negative_prompt "text, words, logo, watermark, signature, duplicate people, malformed hands, oversaturated, low detail, plastic skin, $extra_negative" \
    --arg size "$size" \
    --argjson seed "$seed" \
    '{prompt:$prompt,negative_prompt:$negative_prompt,size:$size,steps:24,guidance_scale:7.0,seed:$seed}' \
    | curl -fsS "$gateway/v1/images/generations" \
        -H 'Content-Type: application/json' \
        -H 'X-Omniserve-Tier: background' \
        --data-binary @- \
    | jq -er '.data[0].b64_json' \
    | base64 -d > "$temporary"
  mv "$temporary" "$destination"
  echo "generated $destination"
}

generate cinematic-director 38241 \
  "Editorial cinematic production still, an original woman film director in a dark soundstage studying a large production monitor, the monitor shows a surreal flooded brutalist atrium at blue hour, cinema camera silhouette and practical controls in the foreground, cool cyan screen light with a subtle warm rim, photoreal, tactile fabric and skin texture, restrained film grain, 16:9 composition, no readable text, no logos"

generate product-orbit 29174 \
  "High-end product photography of a single rectangular matte black glass perfume bottle with a square black cap, one bottle standing upright at the center of a wet obsidian pedestal, charcoal seamless studio background, precise silver rim light, one softbox reflection, faint low mist, crisp realistic commercial macro photograph, elegant symmetrical silhouette, generous negative space, blank package, no label, no text, no logo, no watermark" \
  "768x576" "multiple bottles, extra bottle, glass jar, open container, round container, sphere, loose objects, people, hands"

generate anime-rain 19476 \
  "Original cinematic anime heroine with silver hair and a red rain cape beneath warm paper lanterns at a remote mountain railway platform, summer storm, paper charms lifting in the wind, warm lantern glow against cool rain and distant lightning, clean hand-drawn linework, richly painted background, readable silhouette, atmospheric depth, polished key art, no subtitles, no logo, no watermark"

generate vertical-creator 67129 \
  "Authentic UGC production photograph, medium portrait of a solo smiling young woman content creator in a bright real apartment kitchen, she demonstrates a compact black travel espresso maker with both hands toward a vertical smartphone mounted on a small tabletop tripod, one clear espresso cup on the counter, honest window daylight, natural candid expression, photoreal, clean accurate hands, no text, no logos, no watermark" \
  "768x576" "second person, two women, twins, duplicate woman, extra arms, extra hands"
