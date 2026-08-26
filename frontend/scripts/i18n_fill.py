#!/usr/bin/env python3
"""Fill untranslated strings in frontend/translations/<lang>.json via OpenRouter.

A value is "untranslated" when it is byte-identical to the English source and
not a brand/technical token. Existing translations are never overwritten;
--refresh-stale re-translates entries whose English changed since last fill.

Work is parallelized per batch (not per language) with incremental file saves,
so progress lands on disk continuously.

  python3 scripts/i18n-fill.py --audit
  python3 scripts/i18n-fill.py --langs ja --dry
  python3 scripts/i18n-fill.py --langs all
"""
import argparse
import collections
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TDIR = os.path.join(ROOT, "translations")
MODEL = "google/gemini-2.5-flash"
ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"
BATCH_CHARS = 4000

LANG_NAMES = {
    "de": "German", "es": "Spanish", "fr": "French", "pt": "Portuguese",
    "it": "Italian", "nl": "Dutch", "pl": "Polish", "tr": "Turkish",
    "ru": "Russian", "uk": "Ukrainian", "ar": "Arabic", "hi": "Hindi",
    "id": "Indonesian", "vi": "Vietnamese", "ja": "Japanese", "ko": "Korean",
    "zh": "Simplified Chinese",
}

# Brand/product tokens that stay identical in every language.
KEEP_AS_IS_TERMS = [
    "ManifoldGen", "Manifold H3", "Manifold", "Seedance 2 Fast", "Seedance 2",
    "Seedance Fast", "Seedance", "LTX 2", "LTX", "Wan", "Kling", "Veo",
    "Happy Horse", "ByteDance", "Alibaba", "MiniMax", "Google", "OpenAI",
    "GPT Image", "Grok Imagine", "Nano Banana", "Flux", "API", "NSFW", "SFW",
    "SEO", "URLs", "URL", "JSON", "MCP", "TTS", "UGC", "VFX", "CGI", "AI",
]

# lang -> allowed script ranges for output validation.
ALLOWED_SCRIPTS = {
    "ar": [(0x0600, 0x06FF)],
    "hi": [(0x0900, 0x097F)],
    "ru": [(0x0400, 0x04FF)],
    "uk": [(0x0400, 0x04FF)],
    "ja": [(0x3040, 0x309F), (0x30A0, 0x30FF), (0x4E00, 0x9FFF)],
    "ko": [(0xAC00, 0xD7AF)],
    "zh": [(0x4E00, 0x9FFF)],
}

PRINT_LOCK = threading.Lock()
STATE_LOCK = threading.Lock()


def log(msg):
    with PRINT_LOCK:
        print(msg, flush=True)


def is_keep_as_is(value):
    rest = value
    for term in sorted(KEEP_AS_IS_TERMS, key=len, reverse=True):
        rest = rest.replace(term, "")
    return not re.search(r"[A-Za-z]{2}", rest)


def echo_allowed(fullkey, value):
    """Mirror of i18n-config.ts echoAllowed(): values correct byte-identical
    in every locale (product names, brand-led strings, single tokens)."""
    route, key = fullkey.split("|", 1)
    if " " not in value:
        return True
    if key == "name" or key.endswith(".displayName") or key.endswith(".name"):
        return True
    if any(value.startswith(t) for t in KEEP_AS_IS_TERMS):
        return True
    if route.startswith("/search/") and key == "title":
        return True
    return False


def script_ok(lang, s):
    """Reject output in a foreign script, or with none of the target script."""
    ranges = ALLOWED_SCRIPTS.get(lang)
    if not ranges:
        return True
    for ch in s:
        o = ord(ch)
        foreign = (
            (0x0900 <= o <= 0x097F and lang != "hi")
            or (0x0600 <= o <= 0x06FF and lang != "ar")
            or (0x0400 <= o <= 0x04FF and lang not in ("ru", "uk"))
            or (0xAC00 <= o <= 0xD7AF and lang != "ko")
            or (0x3040 <= o <= 0x30FF and lang != "ja")
        )
        if foreign:
            return False
    return any(lo <= ord(c) <= hi for c in s for lo, hi in ranges)


SYSTEM = (
    "You are a professional software localiser. You output only a JSON object, "
    "never prose, never markdown fences."
)

PROMPT = """Localise the values of this JSON into {lang} for ManifoldGen, a website and API for generating AI video, images and music.

Rules:
- Output a JSON object with EXACTLY the same keys. Values only get translated.
- Every value must end up in {lang}. Do not echo English back unless the term is genuinely used untranslated by native {lang} speakers.
- Keep product and brand names in Latin script: ManifoldGen, Seedance, Wan, LTX, Kling, Veo, Happy Horse, MiniMax, ComfyUI, TikTok, YouTube.
- Page titles / meta descriptions: translate the descriptive words, keep the brand name. They are SEO copy - keep them natural, keyword-rich, and roughly the same length as the source.
- Prices, credit amounts, resolutions (1080p), durations (4-10s) and model names stay as-is.
- Preserve punctuation structure and any placeholders exactly.
- These are marketing/editorial strings for filmmakers and developers: match native register, not word-for-word.

JSON to localise:
{payload}"""

STRICT_NOTE = ("\n\nThe previous attempt was rejected: some values came back in the wrong "
               "language or script. Write every value in {lang} using the {lang} writing "
               "system. Brand names stay Latin, everything else must be {lang}.")


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f, object_pairs_hook=collections.OrderedDict)


def dump(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


_API_KEY = None


def api_key():
    global _API_KEY
    if _API_KEY:
        return _API_KEY
    with PROVIDER_LOCK:
        deepseek = PROVIDER == "deepseek"
    if deepseek:
        k = os.environ.get("DEEPSEEK_API_KEY")
        if k:
            _API_KEY = k
            return k
        sys.exit("no DEEPSEEK_API_KEY found")
    k = os.environ.get("OPENROUTER_API_KEY")
    if k:
        _API_KEY = k
        return k
    for p in (os.path.join(ROOT, "..", ".env"), os.path.join(ROOT, ".env"),
              os.path.expanduser("~/.secretbashrc")):
        if not os.path.exists(p):
            continue
        for line in open(p, encoding="utf-8", errors="ignore"):
            m = re.match(r"\s*(?:export\s+)?OPENROUTER_API_KEY=(.+)", line)
            if m:
                k = m.group(1).strip().strip('"').strip("'")
                if k:
                    _API_KEY = k
                    return k
    sys.exit("no OPENROUTER_API_KEY found")


def flatten(en_routes):
    out = collections.OrderedDict()
    for route, strings in en_routes.items():
        for key, value in strings.items():
            out[f"{route}|{key}"] = value
    return out


DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions"
PROVIDER = "openrouter"
PROVIDER_LOCK = threading.Lock()


def switch_to_deepseek():
    global PROVIDER, _API_KEY
    with PROVIDER_LOCK:
        if PROVIDER != "deepseek":
            PROVIDER = "deepseek"
            _API_KEY = None
            log("switching provider: openrouter budget exhausted -> api.deepseek.com")


def call(lang, items, model, retries=4, strict=False):
    payload = json.dumps(items, ensure_ascii=False, indent=1)
    user = PROMPT.format(lang=LANG_NAMES[lang], payload=payload)
    if strict:
        user += STRICT_NOTE.format(lang=LANG_NAMES[lang])
    body_obj = {
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    last = None
    for attempt in range(retries):
        with PROVIDER_LOCK:
            deepseek = PROVIDER == "deepseek"
        endpoint = DEEPSEEK_ENDPOINT if deepseek else ENDPOINT
        body_obj["model"] = "deepseek-chat" if deepseek else model
        req = urllib.request.Request(
            endpoint,
            json.dumps(body_obj).encode(),
            {
                "Authorization": "Bearer " + api_key(),
                "Content-Type": "application/json",
                "HTTP-Referer": "https://manifoldgen.com",
                "X-Title": "manifoldgen-translate-fill",
            },
        )
        try:
            resp = json.load(urllib.request.urlopen(req, timeout=180))
            txt = resp["choices"][0]["message"]["content"].strip()
            txt = re.sub(r"^```(?:json)?|```$", "", txt, flags=re.M).strip()
            got = json.loads(txt)
            cost = (resp.get("usage") or {}).get("cost", 0.0)
            return {k: v.strip() for k, v in got.items() if k in items and isinstance(v, str) and v.strip()}, cost
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 403 and not deepseek:
                switch_to_deepseek()
                continue
            time.sleep(3 * (attempt + 1))
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(3 * (attempt + 1))
    log(f"  {lang}: batch ({len(items)} strings) failed: {last}")
    return {}, 0.0


class LangState:
    """Per-language translation store with ordered incremental saves."""

    def __init__(self, lang, en_routes):
        self.lang = lang
        self.en_routes = en_routes
        self.path = os.path.join(TDIR, lang + ".json")
        self.values = {}
        if os.path.exists(self.path):
            for route, strings in load(self.path).items():
                for key, value in strings.items():
                    self.values[f"{route}|{key}"] = value
        self.filled_path = os.path.join(TDIR, f"meta.filled.{lang}.json")
        self.filled = load(self.filled_path) if os.path.exists(self.filled_path) else {}

    def missing(self, en_flat, hashes, refresh_stale):
        out = []
        for fullkey, english in en_flat.items():
            if is_keep_as_is(english):
                continue
            tr = self.values.get(fullkey)
            if tr is None and echo_allowed(fullkey, english):
                continue
            stale = refresh_stale and fullkey in self.filled and hashes.get(fullkey) != self.filled[fullkey]
            if tr is None or tr == english or stale:
                out.append((fullkey, english))
        return out

    def apply(self, translations, hashes):
        with STATE_LOCK:
            for fullkey, tr in translations.items():
                self.values[fullkey] = tr
                self.filled[fullkey] = hashes.get(fullkey, "")
            self.save()

    def save(self):
        ordered = collections.OrderedDict()
        for route, strings in self.en_routes.items():
            row = collections.OrderedDict()
            for key in strings:
                value = self.values.get(f"{route}|{key}")
                if value is not None:
                    row[key] = value
            if row:
                ordered[route] = row
        dump(self.path, ordered)
        dump(self.filled_path, self.filled)


def batches_for(miss):
    out, current, size = [], [], 0
    for fullkey, english in miss:
        item_size = len(fullkey) + len(english)
        if current and size + item_size > BATCH_CHARS:
            out.append(dict(current))
            current, size = [], 0
        current.append((fullkey, english))
        size += item_size
    if current:
        out.append(dict(current))
    return out


def audit(en_routes):
    en_flat = flatten(en_routes)
    hashes = load(os.path.join(TDIR, "meta.json"))
    print(f"{'lang':5} {'missing':>8} {'stale':>7}", flush=True)
    for lang in LANG_NAMES:
        path = os.path.join(TDIR, lang + ".json")
        filled_path = os.path.join(TDIR, f"meta.filled.{lang}.json")
        if not os.path.exists(path):
            print(f"{lang:5} {len(en_flat):>8} {'-':>7}", flush=True)
            continue
        flat_cur = {}
        for route, strings in load(path).items():
            for k, v in strings.items():
                flat_cur[f"{route}|{k}"] = v
        filled = load(filled_path) if os.path.exists(filled_path) else {}
        missing = sum(
            1 for kk, eng in en_flat.items()
            if not is_keep_as_is(eng) and (flat_cur.get(kk) is None or flat_cur[kk] == eng)
        )
        stale = sum(1 for kk in filled if hashes.get(kk) and filled[kk] and hashes[kk] != filled[kk])
        print(f"{lang:5} {missing:>8} {stale:>7}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--langs", default="all")
    ap.add_argument("--model", default=MODEL)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--audit", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--concurrency", type=int, default=24)
    ap.add_argument("--refresh-stale", action="store_true")
    args = ap.parse_args()

    en = load(os.path.join(TDIR, "en.json"))
    if args.audit:
        audit(en["routes"])
        return
    langs = list(LANG_NAMES) if args.langs == "all" else [c.strip() for c in args.langs.split(",") if c.strip()]
    en_flat = flatten(en["routes"])
    hashes = load(os.path.join(TDIR, "meta.json"))
    states = {lang: LangState(lang, en["routes"]) for lang in langs}
    tasks = []
    total_missing = 0
    for lang in langs:
        miss = states[lang].missing(en_flat, hashes, args.refresh_stale)
        if args.limit:
            miss = miss[:args.limit]
        total_missing += len(miss)
        if args.dry:
            log(f"  {lang}: {len(miss)} missing")
            continue
        for batch in batches_for(miss):
            tasks.append((lang, batch))
    if args.dry:
        return
    log(f"filling {total_missing} strings across {len(langs)} langs in {len(tasks)} batches")

    t0 = time.time()
    done_batches = [0]
    applied_total = [0]
    cost_total = [0.0]

    def work(item):
        lang, batch = item
        got, cost = call(lang, batch, args.model)
        valid = {k: v for k, v in got.items() if v.strip() and script_ok(lang, v)}
        rejected = [key for key, tr in got.items() if not script_ok(lang, tr)]
        if rejected:
            sub = {key: batch[key] for key in rejected}
            got2, cost2 = call(lang, sub, args.model, retries=2, strict=True)
            cost += cost2
            for key, tr in got2.items():
                if script_ok(lang, tr):
                    valid[key] = tr
        with STATE_LOCK:
            done_batches[0] += 1
            applied_total[0] += len(valid)
            cost_total[0] += cost
            progress = f"[{done_batches[0]}/{len(tasks)}]"
        states[lang].apply(valid, hashes)
        log(f"{progress} {lang}: +{len(valid)} (${cost:.4f})")
        return len(valid), cost

    with ThreadPoolExecutor(max_workers=max(1, args.concurrency)) as pool:
        list(pool.map(work, tasks))

    print(f"TOTAL missing={total_missing} filled={applied_total[0]} cost=${cost_total[0]:.4f} "
          f"in {time.time() - t0:.0f}s", flush=True)


if __name__ == "__main__":
    main()
