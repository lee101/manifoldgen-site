#!/usr/bin/env python3
from __future__ import annotations

import argparse
import fcntl
import json
import os
import re
import shutil
import sqlite3
import sys
import time
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CATALOG = ROOT / "scripts" / "prompts" / "h3-popular-concepts-v1.jsonl"
DEFAULT_DATA_ROOT = Path("/sdb-disk/h3-trajectories")
SAFE_LABEL = re.compile(r"^[a-z0-9][a-z0-9_.-]{0,63}$")


def load_catalog(path: Path) -> list[dict]:
    rows = []
    seen = set()
    with path.open(encoding="utf-8") as source:
        for number, raw in enumerate(source, 1):
            if not raw.strip():
                continue
            row = json.loads(raw)
            required = {"concept", "prompt", "slug", "seed", "split", "rank", "frequency"}
            missing = required - set(row)
            if missing:
                raise SystemExit(f"{path}:{number}: missing {sorted(missing)}")
            slug = str(row["slug"])
            if not SAFE_LABEL.fullmatch(slug):
                raise SystemExit(f"{path}:{number}: invalid slug")
            if slug in seen:
                raise SystemExit(f"{path}:{number}: duplicate slug {slug}")
            seen.add(slug)
            rows.append(row)
    if not rows:
        raise SystemExit(f"empty catalog: {path}")
    return rows


def open_state(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS jobs (
            slug TEXT PRIMARY KEY,
            ordinal INTEGER NOT NULL,
            payload_json TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            attempts INTEGER NOT NULL DEFAULT 0,
            capture_level TEXT,
            trace_id TEXT,
            trajectory_path TEXT,
            trajectory_bytes INTEGER,
            gallery_job_id TEXT,
            video_url TEXT,
            error TEXT,
            started_at REAL,
            completed_at REAL
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS embeddings (
            trace_id TEXT PRIMARY KEY,
            concept TEXT NOT NULL,
            split TEXT NOT NULL,
            gallery_job_id TEXT NOT NULL,
            dimensions INTEGER NOT NULL,
            dtype TEXT NOT NULL,
            vector BLOB NOT NULL,
            created_at REAL NOT NULL
        )
        """
    )
    connection.execute("UPDATE jobs SET status='pending' WHERE status='running'")
    connection.commit()
    return connection


def seed_state(connection: sqlite3.Connection, rows: list[dict]) -> None:
    connection.executemany(
        "INSERT OR IGNORE INTO jobs (slug, ordinal, payload_json) VALUES (?, ?, ?)",
        [(row["slug"], index, json.dumps(row, sort_keys=True)) for index, row in enumerate(rows)],
    )
    connection.commit()


def claim(
    connection: sqlite3.Connection,
    max_attempts: int,
    start_ordinal: int = 0,
    end_ordinal: int = 2**63 - 1,
) -> tuple[str, dict] | None:
    connection.execute("BEGIN IMMEDIATE")
    row = connection.execute(
        "SELECT slug, payload_json FROM jobs WHERE status IN ('pending', 'failed') AND attempts < ? "
        "AND ordinal >= ? AND ordinal < ? ORDER BY ordinal LIMIT 1",
        (max_attempts, start_ordinal, end_ordinal),
    ).fetchone()
    if row is None:
        connection.commit()
        return None
    connection.execute(
        "UPDATE jobs SET status='running', attempts=attempts+1, started_at=?, error=NULL WHERE slug=?",
        (time.time(), row["slug"]),
    )
    connection.commit()
    return row["slug"], json.loads(row["payload_json"])


def latest_capture(root: Path, started: float) -> tuple[Path, dict] | None:
    matches = []
    for manifest_path in root.glob("h3t-*/manifest.json"):
        try:
            if manifest_path.stat().st_mtime + 1 < started:
                continue
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if manifest.get("capture_status") == "completed":
            matches.append((manifest_path.stat().st_mtime, manifest_path.parent, manifest))
    if not matches:
        return None
    _, path, manifest = max(matches, key=lambda item: item[0])
    return path, manifest


def indexed_capture(
    connection: sqlite3.Connection,
    root: Path,
    gallery_job_id: str,
    row: dict,
    capture_level: str,
    dataset: str,
    steps: int,
) -> tuple[Path, dict] | None:
    indexed = connection.execute(
        "SELECT trace_id FROM embeddings WHERE gallery_job_id=? LIMIT 1",
        (gallery_job_id,),
    ).fetchone()
    if indexed is None:
        return None
    path = root / str(indexed["trace_id"])
    try:
        manifest = json.loads((path / "manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    expected = {
        "capture_status": "completed",
        "capture_level": capture_level,
        "dataset": dataset,
        "seed": int(row["seed"]),
        "steps": int(steps),
    }
    if any(manifest.get(key) != value for key, value in expected.items()):
        return None
    return path, manifest


def write_manifest(path: Path, manifest: dict) -> None:
    temp = path.with_suffix(".json.tmp")
    temp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temp.replace(path)


def index_embedding(
    connection: sqlite3.Connection,
    trace_id: str,
    trajectory_path: Path,
    row: dict,
    gallery_job_id: str,
) -> int:
    import torch

    payload = torch.load(trajectory_path / "embedding.pt", map_location="cpu", weights_only=True)
    vector = payload.get("embedding")
    if not torch.is_tensor(vector) or vector.ndim != 1 or vector.numel() == 0:
        raise ValueError("trajectory embedding is missing or invalid")
    normalized = vector.float()
    normalized = normalized / normalized.norm().clamp_min(1e-12)
    packed = normalized.to(dtype=torch.float16).numpy().tobytes()
    connection.execute(
        """
        INSERT INTO embeddings (trace_id, concept, split, gallery_job_id, dimensions, dtype, vector, created_at)
        VALUES (?, ?, ?, ?, ?, 'float16', ?, ?)
        ON CONFLICT(trace_id) DO UPDATE SET concept=excluded.concept, split=excluded.split,
            gallery_job_id=excluded.gallery_job_id, dimensions=excluded.dimensions,
            dtype=excluded.dtype, vector=excluded.vector, created_at=excluded.created_at
        """,
        (trace_id, row["concept"], row["split"], gallery_job_id, int(normalized.numel()), packed, time.time()),
    )
    connection.commit()
    return int(normalized.numel())


def account(gallery, email: str) -> tuple[str, str]:
    escaped = email.replace("'", "''")
    row = gallery.psql(f"SELECT id || E'\\t' || COALESCE(api_key, '') FROM users WHERE email='{escaped}' LIMIT 1;")
    if not row or "\t" not in row:
        raise SystemExit(f"gallery user not found: {email}")
    return tuple(row.split("\t", 1))


def finish_job(connection: sqlite3.Connection, slug: str, **values) -> None:
    columns = [f"{key}=?" for key in values]
    connection.execute(
        f"UPDATE jobs SET {', '.join(columns)}, status='completed', completed_at=? WHERE slug=?",
        [*values.values(), time.time(), slug],
    )
    connection.commit()


def fail_job(connection: sqlite3.Connection, slug: str, error: Exception) -> None:
    connection.execute(
        "UPDATE jobs SET status='failed', error=? WHERE slug=?",
        (str(error)[:2000], slug),
    )
    connection.commit()


def defer_job(connection: sqlite3.Connection, slug: str, reason: Exception) -> None:
    connection.execute(
        "UPDATE jobs SET status='pending', attempts=MAX(attempts-1, 0), error=? WHERE slug=?",
        (str(reason)[:2000], slug),
    )
    connection.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    parser.add_argument("--data-root", type=Path, default=DEFAULT_DATA_ROOT)
    parser.add_argument("--capture", choices=("full", "sketch"), required=True)
    parser.add_argument("--dataset", default="h3-popular-concepts-v1")
    parser.add_argument("--limit", type=int, default=64)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--size", choices=("preview", "balanced"), default="preview")
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--duration", type=float, default=5.0)
    parser.add_argument("--user-email", default="leepenkman@gmail.com")
    parser.add_argument("--reindex-every", type=int, default=25)
    parser.add_argument("--min-free-gib", type=float, default=100.0)
    parser.add_argument("--yield-seconds", type=float, default=0.0)
    parser.add_argument("--stop-when-done", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if (
        not 1 <= args.limit <= 5000
        or args.offset < 0
        or not 1 <= args.max_attempts <= 10
        or not 0 <= args.yield_seconds <= 3600
    ):
        raise SystemExit("invalid limit or max attempts")
    if args.steps != 20:
        raise SystemExit("trajectory dataset v1 requires exactly 20 steps")
    if not SAFE_LABEL.fullmatch(args.dataset):
        raise SystemExit("invalid dataset label")
    rows = load_catalog(args.catalog)
    if args.dry_run:
        selected = rows[args.offset : args.offset + args.limit]
        print(
            json.dumps(
                {
                    "capture": args.capture,
                    "dataset": args.dataset,
                    "first": selected[0]["concept"] if selected else None,
                    "last": selected[-1]["concept"] if selected else None,
                    "offset": args.offset,
                    "rows": len(selected),
                    "size": args.size,
                    "steps": args.steps,
                },
                sort_keys=True,
            )
        )
        return

    args.data_root.mkdir(parents=True, exist_ok=True)
    lock = (args.data_root / "farm.lock").open("w")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise SystemExit("another H3 trajectory farm is already running")

    os.environ["H3_LOCAL_CONTAINER"] = f"h3-trajectory-{args.capture}"
    os.environ["H3_LOCAL_PORT"] = "18291" if args.capture == "full" else "18292"
    os.environ["H3_LOCAL_COMFY_PORT"] = "18293" if args.capture == "full" else "18294"
    os.environ["H3_PATCH_DIR"] = f"/tmp/h3-trajectory-{args.capture}-patch"
    os.environ["H3_TRAJECTORY_CAPTURE"] = args.capture
    os.environ["H3_TRAJECTORY_ROOT"] = str(args.data_root)
    os.environ["H3_TRAJECTORY_DATASET"] = args.dataset
    os.environ["H3_ACCEL_PROFILE"] = "off"
    sys.path.insert(0, str(ROOT / "scripts"))
    import gen_gallery_local as gallery

    gallery.load_dotenv()
    connection = open_state(args.data_root / "farm.sqlite3")
    seed_state(connection, rows)
    free_gib = shutil.disk_usage(args.data_root).free / (1024**3)
    if free_gib < args.min_free_gib:
        raise SystemExit(f"trajectory disk has only {free_gib:.1f} GiB free")
    gallery.ensure_container()
    user_id, api_key = account(gallery, args.user_email)

    completed = 0
    selected_incomplete = 0
    try:
        while completed < args.limit:
            claimed = claim(connection, args.max_attempts, args.offset, args.offset + args.limit)
            if claimed is None:
                break
            slug, row = claimed
            local = None
            started = time.time()
            print(f"[{completed + 1}/{args.limit}] {row['concept']} capture={args.capture}", flush=True)
            try:
                job_id = f"video_h3_{slug.replace('-', '_')}"
                recovered = indexed_capture(
                    connection,
                    args.data_root,
                    job_id,
                    row,
                    args.capture,
                    args.dataset,
                    args.steps,
                )
                if recovered is not None:
                    trajectory_path, manifest = recovered
                    escaped_job_id = job_id.replace("'", "''")
                    video_url = gallery.psql(
                        f"SELECT COALESCE(result_json->>'video_url', '') FROM video_jobs "
                        f"WHERE id='{escaped_job_id}' LIMIT 1;"
                    )
                    if not video_url:
                        raise RuntimeError("indexed trajectory is missing its gallery video")
                    print(f"  recovering indexed capture {manifest['trace_id']}", flush=True)
                else:
                    local = gallery.generate(
                        row["prompt"],
                        size=args.size,
                        steps=args.steps,
                        duration=args.duration,
                        seed=int(row["seed"]),
                    )
                    captured = latest_capture(args.data_root, started)
                    if captured is None:
                        raise RuntimeError("generation completed without a trajectory artifact")
                    trajectory_path, manifest = captured
                    video_url = gallery.upload(local, slug)
                trace_id = str(manifest["trace_id"])
                metadata = {
                    "trajectory_trace_id": trace_id,
                    "trajectory_capture": args.capture,
                    "trajectory_dataset": args.dataset,
                    "trajectory_concept": row["concept"],
                    "trajectory_split": row["split"],
                    "trajectory_rank": row["rank"],
                    "trajectory_frequency": row["frequency"],
                }
                gallery.upsert(
                    job_id,
                    user_id,
                    row["prompt"],
                    video_url,
                    size=args.size,
                    quant="int8_convrot",
                    metadata=metadata,
                )
                embedding_dimensions = index_embedding(connection, trace_id, trajectory_path, row, job_id)
                manifest.update(
                    {
                        "concept": row["concept"],
                        "concept_frequency": row["frequency"],
                        "concept_rank": row["rank"],
                        "gallery_job_id": job_id,
                        "embedding_dimensions": embedding_dimensions,
                        "embedding_index": str(args.data_root / "farm.sqlite3"),
                        "source": row.get("source", "netwrck"),
                        "split": row["split"],
                        "video_url": video_url,
                    }
                )
                write_manifest(trajectory_path / "manifest.json", manifest)
                finish_job(
                    connection,
                    slug,
                    capture_level=args.capture,
                    trace_id=trace_id,
                    trajectory_path=str(trajectory_path),
                    trajectory_bytes=int(manifest.get("artifact_bytes") or 0),
                    gallery_job_id=job_id,
                    video_url=video_url,
                )
                completed += 1
                if args.reindex_every and completed % args.reindex_every == 0:
                    gallery.reindex(api_key)
                if args.yield_seconds and completed < args.limit:
                    print(f"  yielding {args.yield_seconds:g}s to production", flush=True)
                    time.sleep(args.yield_seconds)
            except KeyboardInterrupt:
                connection.execute(
                    "UPDATE jobs SET status='pending', error='interrupted by operator' WHERE slug=?",
                    (slug,),
                )
                connection.commit()
                raise
            except (gallery.PredictionCanceled, gallery.PredictionCapacityUnavailable) as error:
                defer_job(connection, slug, error)
                print(f"  DEFER {slug}: {error}", flush=True)
                break
            except Exception as error:
                fail_job(connection, slug, error)
                print(f"  FAIL {slug}: {error}", flush=True)
            finally:
                if local is not None:
                    local.unlink(missing_ok=True)
                    try:
                        local.parent.rmdir()
                    except OSError:
                        pass
            free_gib = shutil.disk_usage(args.data_root).free / (1024**3)
            if free_gib < args.min_free_gib:
                print(f"stopping: free disk {free_gib:.1f} GiB", flush=True)
                break
    finally:
        gallery.reindex(api_key)
        if args.stop_when_done:
            gallery.stop_container()
        selected_incomplete = connection.execute(
            "SELECT COUNT(*) FROM jobs WHERE ordinal >= ? AND ordinal < ? AND status != 'completed'",
            (args.offset, args.offset + args.limit),
        ).fetchone()[0]
        summary = dict(connection.execute("SELECT status, COUNT(*) FROM jobs GROUP BY status").fetchall())
        print(
            json.dumps(
                {
                    "completed_this_run": completed,
                    "queue": summary,
                    "selected_incomplete": selected_incomplete,
                },
                sort_keys=True,
            )
        )
        connection.close()
    if selected_incomplete:
        raise SystemExit(75)


if __name__ == "__main__":
    main()
