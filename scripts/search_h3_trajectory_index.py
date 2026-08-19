#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

import numpy as np
import torch


def load_query(path: Path) -> np.ndarray:
    payload = torch.load(path, map_location="cpu", weights_only=True)
    vector = payload.get("embedding")
    if not torch.is_tensor(vector) or vector.ndim != 1:
        raise ValueError("query embedding must be a one-dimensional tensor")
    output = vector.float().numpy()
    norm = np.linalg.norm(output)
    if norm <= 0:
        raise ValueError("query embedding has zero norm")
    return output / norm


def search(database: Path, query: np.ndarray, top_k: int, split: str = "") -> list[dict]:
    connection = sqlite3.connect(database)
    sql = "SELECT trace_id, concept, split, gallery_job_id, dimensions, vector FROM embeddings"
    params: tuple = ()
    if split:
        sql += " WHERE split = ?"
        params = (split,)
    rows = []
    for trace_id, concept, row_split, job_id, dimensions, blob in connection.execute(sql, params):
        if int(dimensions) != query.size:
            continue
        vector = np.frombuffer(blob, dtype=np.float16).astype(np.float32)
        score = float(np.dot(query, vector) / max(np.linalg.norm(vector), 1e-12))
        rows.append(
            {
                "trace_id": trace_id,
                "concept": concept,
                "split": row_split,
                "gallery_job_id": job_id,
                "similarity": score,
            }
        )
    connection.close()
    rows.sort(key=lambda row: row["similarity"], reverse=True)
    return rows[:top_k]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, default=Path("/sdb-disk/h3-trajectories/farm.sqlite3"))
    parser.add_argument("--embedding", type=Path, required=True)
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--split", choices=("", "train", "validation", "test"), default="")
    args = parser.parse_args()
    if not 1 <= args.top_k <= 100:
        raise SystemExit("--top-k must be between 1 and 100")
    print(json.dumps(search(args.database, load_query(args.embedding), args.top_k, args.split), indent=2))


if __name__ == "__main__":
    main()
