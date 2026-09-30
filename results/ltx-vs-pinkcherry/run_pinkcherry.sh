cd /vfast/data/code/manifoldgen-site; set -a; . ./.env; set +a
EP=$(python3 -c "import json;print([e['id'] for e in json.load(open('config/runpod-h3.json'))['endpoints'] if 'pinkcherry' in e['name']][0])")
for k in rooftop apartment beach; do
  P=$(python3 -c "import json;print(json.load(open('results/ltx-vs-pinkcherry/prompts.json'))['$k'])")
  python3 results/ltx-vs-pinkcherry/ua_run.py scripts/runpod-h3-direct-canary.py --endpoint $EP --aspect-ratio 16:9 --size balanced --duration 5 --seed 1 --prompt "$P" --output-path results/ltx-vs-pinkcherry/pinkcherry/$k.webm --summary-path results/ltx-vs-pinkcherry/pinkcherry/$k.json --leave-active 2>&1 | tail -3
done
