#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import torch


def trace_rows(root: Path) -> list[dict]:
    rows = []
    for manifest_path in root.glob("h3t-*/manifest.json"):
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("capture_status") != "completed" or manifest.get("capture_level") != "full":
            continue
        sketch_path = manifest_path.parent / "sketches.pt"
        if not sketch_path.exists():
            continue
        sketches = torch.load(sketch_path, map_location="cpu", weights_only=True)
        vectors = {}
        for row in sketches:
            step = int(row.get("step", -1))
            if step < 0:
                continue
            samples = [part["sample"].float().reshape(-1) for part in row.get("state", []) if "sample" in part]
            if samples:
                vectors[step] = torch.cat(samples)
        if len(vectors) < 3:
            continue
        rows.append(
            {
                "root": manifest_path.parent,
                "manifest": manifest,
                "steps": max(vectors) + 1,
                "vectors": vectors,
            }
        )
    return rows


def fit_alpha(traces: list[dict], step: int, horizon: int) -> tuple[float, int]:
    numerator = 0.0
    denominator = 0.0
    used = 0
    for trace in traces:
        if step + horizon >= trace["steps"]:
            continue
        previous = trace["vectors"].get(step - 1)
        current = trace["vectors"].get(step)
        target = trace["vectors"].get(step + horizon)
        if previous is None or current is None or target is None or previous.shape != current.shape or current.shape != target.shape:
            continue
        momentum = current - previous
        target_delta = target - current
        numerator += float(torch.dot(momentum, target_delta))
        denominator += float(torch.dot(momentum, momentum))
        used += 1
    return (numerator / denominator if denominator > 0 else 0.0), used


def evaluate_alpha(traces: list[dict], step: int, horizon: int, alpha: float) -> tuple[float, int]:
    error_sq = 0.0
    movement_sq = 0.0
    used = 0
    for trace in traces:
        if step + horizon >= trace["steps"]:
            continue
        previous = trace["vectors"].get(step - 1)
        current = trace["vectors"].get(step)
        target = trace["vectors"].get(step + horizon)
        if previous is None or current is None or target is None or previous.shape != current.shape or current.shape != target.shape:
            continue
        prediction = current + alpha * (current - previous)
        error = prediction - target
        movement = target - current
        error_sq += float(torch.dot(error, error))
        movement_sq += float(torch.dot(movement, movement))
        used += 1
    return (math.sqrt(error_sq / movement_sq) if movement_sq > 0 else 0.0), used


def analyze(root: Path, horizons: list[int]) -> dict:
    traces = trace_rows(root)
    train = [trace for trace in traces if trace["manifest"].get("split") == "train"]
    held_out = [trace for trace in traces if trace["manifest"].get("split") in {"validation", "test"}]
    if not train or not held_out:
        raise ValueError("analysis requires full train and held-out trajectories")
    max_steps = min(trace["steps"] for trace in traces)
    cells = []
    for horizon in horizons:
        for step in range(1, max_steps - horizon):
            alpha, fitted = fit_alpha(train, step, horizon)
            identity, evaluated = evaluate_alpha(held_out, step, horizon, 0.0)
            raw, _ = evaluate_alpha(held_out, step, horizon, float(horizon))
            calibrated, _ = evaluate_alpha(held_out, step, horizon, alpha)
            cells.append(
                {
                    "step": step,
                    "horizon": horizon,
                    "alpha": alpha,
                    "fit_trajectories": fitted,
                    "eval_trajectories": evaluated,
                    "identity_rel_l2": identity,
                    "raw_momentum_rel_l2": raw,
                    "calibrated_rel_l2": calibrated,
                }
            )
    valid = [cell for cell in cells if cell["eval_trajectories"] > 0]
    mean = lambda key: sum(cell[key] for cell in valid) / len(valid)
    summary = {
        "identity_rel_l2": mean("identity_rel_l2"),
        "raw_momentum_rel_l2": mean("raw_momentum_rel_l2"),
        "calibrated_rel_l2": mean("calibrated_rel_l2"),
    }
    return {
        "schema_version": 1,
        "root": str(root),
        "full_trajectories": len(traces),
        "train_trajectories": len(train),
        "held_out_trajectories": len(held_out),
        "horizons": horizons,
        "metric": "fixed-stride latent-sketch relL2",
        "summary": summary,
        "retrieval_gate_passed": summary["calibrated_rel_l2"] < summary["raw_momentum_rel_l2"],
        "cells": cells,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path("/sdb-disk/h3-trajectories"))
    parser.add_argument("--horizons", default="1,2,4")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    horizons = sorted({int(value) for value in args.horizons.split(",") if value.strip()})
    if not horizons or horizons[0] < 1:
        raise SystemExit("horizons must be positive integers")
    result = analyze(args.root, horizons)
    output = json.dumps(result, indent=2, sort_keys=True) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")


if __name__ == "__main__":
    main()
