#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COUNT="${H3_TRAJECTORY_COUNT:-1000}"
FULL_COUNT="${H3_TRAJECTORY_FULL_COUNT:-64}"
DATA_ROOT="${H3_TRAJECTORY_ROOT:-/sdb-disk/h3-trajectories}"
CATALOG="${H3_TRAJECTORY_CATALOG:-$ROOT/scripts/prompts/h3-popular-concepts-v1.jsonl}"
MIN_FREE_GIB="${H3_TRAJECTORY_MIN_FREE_GIB:-100}"
USER_EMAIL="${H3_TRAJECTORY_USER_EMAIL:-leepenkman@gmail.com}"
YIELD_SECONDS="${H3_TRAJECTORY_YIELD_SECONDS:-30}"
SKETCH_STAGE="${H3_TRAJECTORY_SKETCH_STAGE:-0}"
MAX_COMPACT_RANK="${H3_TRAJECTORY_MAX_COMPACT_RANK:-16}"

if ! [[ "$COUNT" =~ ^[1-9][0-9]*$ ]] || [ "$COUNT" -gt 5000 ]; then
  echo "H3_TRAJECTORY_COUNT must be between 1 and 5000" >&2
  exit 1
fi
if ! [[ "$FULL_COUNT" =~ ^[0-9]+$ ]] || [ "$FULL_COUNT" -gt "$COUNT" ]; then
  echo "H3_TRAJECTORY_FULL_COUNT must be between 0 and H3_TRAJECTORY_COUNT" >&2
  exit 1
fi
if ! [[ "$YIELD_SECONDS" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "H3_TRAJECTORY_YIELD_SECONDS must be a non-negative number" >&2
  exit 1
fi
if [ "$SKETCH_STAGE" != "0" ] && [ "$SKETCH_STAGE" != "1" ]; then
  echo "H3_TRAJECTORY_SKETCH_STAGE must be 0 or 1" >&2
  exit 1
fi
if ! [[ "$MAX_COMPACT_RANK" =~ ^[1-9][0-9]*$ ]] || [ "$MAX_COMPACT_RANK" -gt 64 ]; then
  echo "H3_TRAJECTORY_MAX_COMPACT_RANK must be between 1 and 64" >&2
  exit 1
fi

python scripts/build_h3_trajectory_catalog.py --count "$COUNT" --output "$CATALOG"

if [ "$FULL_COUNT" -gt 0 ]; then
  python scripts/h3_trajectory_farm.py \
    --catalog "$CATALOG" \
    --data-root "$DATA_ROOT" \
    --capture full \
    --offset 0 \
    --limit "$FULL_COUNT" \
    --steps 20 \
    --size preview \
    --min-free-gib "$MIN_FREE_GIB" \
    --yield-seconds "$YIELD_SECONDS" \
    --user-email "$USER_EMAIL" \
    --stop-when-done

  # Keep the lossless raw calibration states until the quality audit is signed
  # off, while also producing a much smaller serving/research representation.
  nice -n 15 ionice -c3 python scripts/compact_h3_trajectories.py \
    --root "$DATA_ROOT" \
    --limit "$FULL_COUNT" \
    --target-rel-l2 0.003 \
    --max-rank "$MAX_COMPACT_RANK" \
    --overwrite

  python scripts/analyze_h3_trajectories.py \
    --root "$DATA_ROOT" \
    --horizons 1,2,4 \
    --output "$DATA_ROOT/analysis-${FULL_COUNT}.json"
fi

SKETCH_COUNT=$((COUNT - FULL_COUNT))
if [ "$SKETCH_STAGE" = "1" ] && [ "$SKETCH_COUNT" -gt 0 ]; then
  python scripts/h3_trajectory_farm.py \
    --catalog "$CATALOG" \
    --data-root "$DATA_ROOT" \
    --capture sketch \
    --offset "$FULL_COUNT" \
    --limit "$SKETCH_COUNT" \
    --steps 20 \
    --size preview \
    --min-free-gib "$MIN_FREE_GIB" \
    --yield-seconds "$YIELD_SECONDS" \
    --user-email "$USER_EMAIL" \
    --stop-when-done
elif [ "$SKETCH_COUNT" -gt 0 ]; then
  echo "Sketch stage gated: set H3_TRAJECTORY_SKETCH_STAGE=1 after reviewing analysis-${FULL_COUNT}.json"
fi
