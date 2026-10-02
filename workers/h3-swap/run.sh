#!/bin/bash
# usage: run.sh name script-file
P=$(python3 -c "import json;d=json.load(open('${POD_FILE:-/tmp/h3swap_pod}'));print(d['id'],d['token'])")
set -- $P "$@"
curl -s -m 30 -X POST --data-binary @"$4" "https://$1-8001.proxy.runpod.net/run/$2?name=$3"
