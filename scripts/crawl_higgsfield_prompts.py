#!/usr/bin/env python3
"""Crawl Higgsfield's public prompt guides and build ManifoldGen index queues.

Every page listed in higgsfield.ai's public sitemaps is fetched once and the
complete copy-to-clipboard prompt cards are extracted. Text is sanitized with
the same safety filter as import_prompt_sources.py. Only prompt TEXT is taken;
no competitor media is hotlinked - our own workers render the indexed assets.

Outputs under scripts/prompts/higgsfield/:
  prompts-full.jsonl   {id,title,source_url,prompt,kind,needs_reference}
  image-queue.jsonl    {"prompt","width","height"} for generate_gallery_art.py
  video-queue.jsonl    self-contained text-to-video prompts for the H3 farm
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "scripts" / "prompts" / "higgsfield"

SITEMAPS = [
    "https://higgsfield.ai/blog/sitemap.xml",
    "https://higgsfield.ai/creator-hub/sitemap.xml",
    "https://higgsfield.ai/motion/sitemap.xml",
    "https://higgsfield.ai/mixed-media-presets/sitemap.xml",
    "https://higgsfield.ai/apps/sitemap.xml",
]

USER_AGENT = "ManifoldGen-PromptCrawler/1.0 (+https://manifoldgen.com)"

# Copy-card marker: each prompt block closes right before this button row.
COPY_ROW = '<div class="mt-4 flex flex-wrap justify-end gap-2">'
PROMPT_RE = re.compile(r">([^<>]{60,}?)</div></div>" + re.escape(COPY_ROW), re.S)
CODE_RE = re.compile(r"<pre[^>]*>\s*<code[^>]*>(.*?)</code>", re.S)

# Same conservative filter as import_prompt_sources.py.
BLOCKED = re.compile(
    r"(?ix)\b(?:child(?:ren)?|kid(?:s)?|baby|infant|toddler|underage|minor|loli|shota|"
    r"nude|nudity|naked|nsfw|porn(?:ographic)?|explicit|sexual|sexually|fetish|"
    r"genital(?:s)?|breast(?:s)?|boob(?:s)?|nipples?|lingerie|xxx|rape|gore|"
    r"decapitat|dismember|bloodbath)\b"
)

REFERENCE_RE = re.compile(r"(?i)\b(active references?|reference images?|from the reference|locked to the reference)\b")
VIDEO_HINTS = (
    re.compile(r"(?i)\b(hard cut|hazard|segment \d|shot \d|format mode|fps|24fps|30fps|real-time motion|camera:|dolly|whip-pan|push-in)\b"),
    re.compile(r"(?i)\b(video|film|cinematic|ugc|ad |commercial|trailer|sequence)\b"),
)
MAX_RENDER_PROMPT = 900  # generate_gallery_art.read_prompts cap


MAX_QUEUE_PROMPT = 4000  # longer blocks are full workflow screenplays, not single prompts


def dedupe_key(text: str) -> str:
    return text.lower().rstrip(".! \t").strip()

MEDIA_DEPENDENT_RE = re.compile(
    r"(?i)\b(V2V|edit this video|provided start frame|character sheet|prop sheet|object sheet"
    r"|reference image|reference video)\b|\b(?:video|image)_\d+\b|<<<"
)

def fetch(url: str, timeout: float = 20.0) -> str | None:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8", "replace")
    except (urllib.error.URLError, OSError) as error:
        print(f"fetch failed {url}: {error}", file=sys.stderr)
        return None


def sitemap_urls(sitemap_url: str) -> list[str]:
    body = fetch(sitemap_url)
    if not body:
        return []
    if "<sitemapindex" in body:
        nested = re.findall(r"<loc>(.*?)</loc>", body)
        out: list[str] = []
        for child in nested:
            out.extend(sitemap_urls(child))
        return out
    return re.findall(r"<loc>(.*?)</loc>", body)


def clean(text: str) -> str:
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip(" \t\r\n`\"'")
    return text.strip()


def extract_prompts(page: str) -> list[str]:
    found = [clean(m) for m in PROMPT_RE.findall(page)]
    if not found:
        found = [clean(re.sub(r"<[^>]+>", " ", m)) for m in CODE_RE.findall(page)]
    return found


def truncate_for_render(prompt: str) -> str:
    if len(prompt) <= MAX_RENDER_PROMPT:
        return prompt
    window = prompt[:MAX_RENDER_PROMPT]
    stop = max(window.rfind(". "), window.rfind("; "))
    if stop < MAX_RENDER_PROMPT // 2:
        stop = window.rfind(", ")
    if stop < MAX_RENDER_PROMPT // 2:
        stop = window.rfind(" ")
    return window[: stop + 1].strip() if stop > 0 else window.strip()


def classify(title: str, prompt: str) -> tuple[str, bool]:
    blob = f"{title}\n{prompt}"
    is_video = any(rx.search(blob) for rx in VIDEO_HINTS)
    kind = "video" if is_video else "image"
    return kind, bool(REFERENCE_RE.search(blob))


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:80]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument("--video-limit", type=int, default=16)
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = parser.parse_args()

    urls: list[str] = []
    for sitemap in SITEMAPS:
        batch = sitemap_urls(sitemap)
        print(f"{sitemap}: {len(batch)} urls", flush=True)
        urls.extend(batch)
    urls = sorted(set(urls))
    print(f"total {len(urls)} pages", flush=True)

    rows: list[dict] = []
    seen_hashes: set[str] = set()
    pages_with_prompts = 0
    for number, page_url in enumerate(urls, 1):
        page = fetch(page_url)
        time.sleep(args.delay)
        if not page:
            continue
        title_match = re.search(r"<title>(.*?)</title>", page, re.S)
        title = clean(title_match.group(1)) if title_match else page_url.rsplit("/", 1)[-1]
        extracted = extract_prompts(page)
        if not extracted:
            continue
        kept = 0
        for text in extracted:
            if BLOCKED.search(text) or len(text) < 40:
                continue
            digest = hashlib.sha256(dedupe_key(text).encode()).hexdigest()
            kind, needs_reference = classify(title, text)
            if MEDIA_DEPENDENT_RE.search(text):
                needs_reference = True
            seen_hashes.add(digest)
            rows.append({
                "id": f"hf_{digest[:12]}",
                "title": title,
                "source_url": page_url,
                "prompt": text,
                "kind": kind,
                "needs_reference": needs_reference,
            })
            kept += 1
        if kept:
            pages_with_prompts += 1
        if number % 50 == 0:
            print(f"  crawled {number}/{len(urls)}, prompts so far {len(rows)}", flush=True)

    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    with (out_dir / "prompts-full.jsonl").open("w") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    # Renderable queues exclude reference-dependent prompts and the rare
    # multi-thousand-char workflow screenplays; both stay in prompts-full.
    renderable = [r for r in rows if not r["needs_reference"] and len(r["prompt"]) <= MAX_QUEUE_PROMPT]
    dimensions = [(1024, 1024), (832, 1216), (1216, 832)]
    with (out_dir / "image-queue.jsonl").open("w") as handle:
        for index, row in enumerate(renderable):
            width, height = dimensions[index % len(dimensions)]
            handle.write(json.dumps({
                "prompt": truncate_for_render(row["prompt"]),
                "width": width,
                "height": height,
            }, ensure_ascii=False) + "\n")

    eligible = [r for r in renderable if r["kind"] == "video" and len(r["prompt"]) >= 200]
    with (out_dir / "video-queue.jsonl").open("w") as handle:
        for row in eligible[: args.video_limit]:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    blocked_estimate = sum(1 for u in urls if u)
    print(json.dumps({
        "pages": blocked_estimate,
        "pages_with_prompts": pages_with_prompts,
        "prompts": len(rows),
        "video": sum(1 for r in rows if r["kind"] == "video"),
        "renderable": len(renderable),
        "image_queue": len(renderable),
        "video_queue": min(len(eligible), args.video_limit),
    }, sort_keys=True))


if __name__ == "__main__":
    main()
