#!/usr/bin/env python3
"""Roll per-job H3 worker logs into one archive per fortnight for offline audit on prod.

Workers PUT `h3-flex-logs/YYYY/MM/DD/<uuid>.log.gz` into the PRIVATE H3_LOG_BUCKET at job end (see
h3-cog-flex/h3_joblog.py). Every 2 weeks this bundles days older than --keep-days into
`h3-flex-logs/archive/<first>_<last>.tar.gz` plus a one-line-per-job `.index.tsv` (job id, status, seconds, error),
verifies the upload, then deletes the originals. Dry run unless --apply. Needs the aws CLI and R2 creds in env
(AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/R2_ENDPOINT or CLOUDFLARE_R2_*; same as the other publish scripts).
"""
import argparse, datetime as dt, gzip, io, json, os, subprocess, sys, tarfile, tempfile
from pathlib import Path

PREFIX = "manifoldgen-site/h3-flex-logs/"  # overridable with --prefix; one prefix per site/service in the shared private bucket


def old_days(keys, today, keep_days, prefix=None):
    """Group raw log keys by day, keeping only days strictly older than keep_days. Archive keys are ignored."""
    cutoff = today - dt.timedelta(days=keep_days)
    days = {}
    for key in keys:
        parts = key[len(prefix or PREFIX):].split("/")
        if len(parts) != 4 or not parts[3].endswith(".log.gz"):
            continue
        try:
            day = dt.date(int(parts[0]), int(parts[1]), int(parts[2]))
        except ValueError:
            continue
        if day < cutoff:
            days.setdefault(day, []).append(key)
    return days


def aws(*args, endpoint):
    done = subprocess.run(["aws", "--endpoint-url", endpoint, *args], capture_output=True, text=True)
    if done.returncode == 1 and args[:2] == ("s3", "ls") and not done.stdout.strip():
        return ""  # aws exits 1 on an empty prefix
    if done.returncode:
        raise RuntimeError(f"aws {' '.join(args[:3])} failed: {done.stderr.strip()[-300:]}")
    return done.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", default=os.environ.get("H3_LOG_BUCKET", "private"))
    ap.add_argument("--prefix", default=os.environ.get("H3_LOG_PREFIX", PREFIX).strip("/") + "/")
    ap.add_argument("--keep-days", type=int, default=14)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    prefix = a.prefix
    if not a.bucket:
        sys.exit("H3_LOG_BUCKET / --bucket required")
    acct = os.environ.get("R2_ACCOUNT_ID") or os.environ.get("CLOUDFLARE_R2_ACCOUNT_ID", "")
    endpoint = os.environ.get("R2_ENDPOINT") or f"https://{acct}.r2.cloudflarestorage.com"
    os.environ.setdefault("AWS_ACCESS_KEY_ID", os.environ.get("CLOUDFLARE_R2_ACCESS_KEY_ID", ""))
    os.environ.setdefault("AWS_SECRET_ACCESS_KEY", os.environ.get("CLOUDFLARE_R2_SECRET_ACCESS_KEY", ""))
    os.environ.setdefault("AWS_DEFAULT_REGION", "auto")
    listing = aws("s3", "ls", f"s3://{a.bucket}/{prefix}", "--recursive", endpoint=endpoint)
    keys = [line.split(None, 3)[3] for line in listing.splitlines() if len(line.split(None, 3)) == 4]
    days = old_days(keys, dt.date.today(), a.keep_days, prefix)
    if not days:
        print("nothing to roll up"); return
    first, last = min(days), max(days)
    n = sum(len(v) for v in days.values())
    name = f"{first}_{last}"
    print(f"{n} logs over {len(days)} days -> {prefix}archive/{name}.tar.gz" + ("" if a.apply else "  (dry run)"))
    if not a.apply:
        return
    with tempfile.TemporaryDirectory() as tmp:
        archive, index = Path(tmp, f"{name}.tar.gz"), Path(tmp, f"{name}.index.tsv")
        rows = []
        with tarfile.open(archive, "w:gz") as tar:
            for day in sorted(days):
                for key in days[day]:
                    local = Path(tmp, "x.log.gz")
                    aws("s3", "cp", f"s3://{a.bucket}/{key}", str(local), endpoint=endpoint)
                    tar.add(local, arcname=key[len(prefix):])
                    try:
                        head = json.loads(gzip.open(local, "rt").readline())
                        rows.append("\t".join(str(head.get(k, "")) for k in ("job_id", "status", "seconds")) + f"\t{key}\t{(head.get('error') or '')[:200]}")
                    except Exception:
                        rows.append(f"\t\t\t{key}\tunreadable header")
        index.write_text("\n".join(rows) + "\n")
        for f in (archive, index):
            aws("s3", "cp", str(f), f"s3://{a.bucket}/{prefix}archive/{f.name}", endpoint=endpoint)
        remote = aws("s3", "ls", f"s3://{a.bucket}/{prefix}archive/{archive.name}", endpoint=endpoint).split()
        if len(remote) < 3 or int(remote[2]) != archive.stat().st_size:
            sys.exit("archive upload not verified; originals kept")
    for day_keys in days.values():
        for key in day_keys:
            aws("s3", "rm", f"s3://{a.bucket}/{key}", endpoint=endpoint)
    print("rolled up and removed originals")


if __name__ == "__main__":
    main()
