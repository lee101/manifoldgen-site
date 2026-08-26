#!/usr/bin/env python3
"""Ask a vision model to judge a labelled multi-frame H3 style A/B sheet."""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import urllib.request
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("contact_sheet", type=Path)
    parser.add_argument("--prompt", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--model", default="deepseek-v4-flash-vision-exp")
    parser.add_argument("--candidate-label", default="Studio 1939 strong r64 at 0.65")
    parser.add_argument("--url", default="https://openpaths.io/v1/chat/completions")
    args = parser.parse_args()

    api_key = os.environ.get("OPENPATHS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENPATHS_API_KEY is required")
    encoded = base64.b64encode(args.contact_sheet.read_bytes()).decode()
    instruction = (
        "Judge this same-seed animation A/B contact sheet. Top row A is base H3; "
        f"bottom row B adds {args.candidate_label}. Pick the better overall result for "
        "the requested prompt. Priority: (1) coherent anatomy, objects, and action "
        "across frames; (2) prompt and composition adherence; (3) authentic 1920s/1930s "
        "painted-cel style. Style alone must not excuse malformed or missing content. "
        "Return only compact JSON: {\"winner\":\"A|B|TIE\",\"confidence\":0..1,"
        "\"reason\":\"under 20 words\"}. Prompt: " + args.prompt
    )
    payload = {
        "model": args.model,
        "temperature": 0,
        "max_tokens": 100,
        "thinking": {"type": "disabled"},
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": instruction},
                {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + encoded}},
            ],
        }],
    }
    request = urllib.request.Request(
        args.url,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "manifoldgen-style-gate/1.0",
        },
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        result = json.load(response)
    content = result["choices"][0]["message"]["content"]
    if isinstance(content, list):
        content = "".join(str(item.get("text", "")) for item in content if isinstance(item, dict))
    match = re.search(r"\{.*\}", str(content), flags=re.DOTALL)
    if not match:
        raise RuntimeError("judge returned no JSON object")
    decision = json.loads(match.group(0))
    if decision.get("winner") not in {"A", "B", "TIE"}:
        raise RuntimeError("judge returned an invalid winner")
    decision["confidence"] = max(0.0, min(1.0, float(decision.get("confidence", 0))))
    decision.update({"model": args.model, "contact_sheet": args.contact_sheet.name})
    rendered = json.dumps(decision, indent=2, sort_keys=True) + "\n"
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered)
    print(rendered, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
