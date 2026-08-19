#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import torch


DEFAULT_ROOT = Path("/sdb-disk/h3-trajectories")
PCA_BLOCK_SIZE = 2048


def load_states(trace: Path) -> tuple[torch.Tensor, list[list[int]], list[int], list[str]]:
    rows = []
    shapes: list[list[int]] | None = None
    sizes: list[int] | None = None
    files = []
    for path in sorted(trace.glob("step-*.pt")):
        payload = torch.load(path, map_location="cpu", weights_only=True)
        tensors = payload.get("state")
        if not isinstance(tensors, list) or not tensors or not all(torch.is_tensor(value) for value in tensors):
            raise ValueError(f"invalid state payload: {path}")
        row_shapes = [list(value.shape) for value in tensors]
        row_sizes = [int(value.numel()) for value in tensors]
        if shapes is None:
            shapes, sizes = row_shapes, row_sizes
        elif shapes != row_shapes:
            raise ValueError(f"state shapes changed within trajectory: {path}")
        rows.append(torch.cat([value.float().reshape(-1) for value in tensors]))
        files.append(path.name)
    if len(rows) < 3 or shapes is None or sizes is None:
        raise ValueError(f"trajectory needs at least three captured states: {trace}")
    return torch.stack(rows), shapes, sizes, files


def temporal_pca(
    states: torch.Tensor,
    *,
    target_rel_l2: float,
    max_rank: int,
) -> tuple[dict, float, int]:
    mean = states.mean(dim=0, keepdim=True)
    centered = states - mean
    gram = centered @ centered.T
    eigenvalues, eigenvectors = torch.linalg.eigh(gram)
    order = torch.argsort(eigenvalues, descending=True)
    eigenvalues = eigenvalues[order].clamp_min(0)
    eigenvectors = eigenvectors[:, order]
    energy = states.square().sum().clamp_min(1e-12)
    best = None
    upper = min(max_rank, states.shape[0] - 1)
    for rank in range(1, upper + 1):
        singular = eigenvalues[:rank].sqrt().clamp_min(1e-12)
        temporal = eigenvectors[:, :rank]
        basis = (temporal.T @ centered) / singular[:, None]
        coefficients = temporal * singular[None, :]
        stored_mean = mean[0].to(torch.float16).contiguous()
        basis_q, basis_scale = quantize_basis(basis, PCA_BLOCK_SIZE)
        stored_coefficients = coefficients.to(torch.float32).contiguous()
        decoded_basis = dequantize_basis(
            basis_q,
            basis_scale,
            elements=int(basis.shape[1]),
            block_size=PCA_BLOCK_SIZE,
        )
        reconstructed = stored_mean.float()[None, :] + stored_coefficients @ decoded_basis
        rel_l2 = float(((reconstructed - states).square().sum() / energy).sqrt().item())
        best = (
            {
                "mean": stored_mean,
                "basis_q": basis_q,
                "basis_scale": basis_scale,
                "basis_elements": int(basis.shape[1]),
                "basis_block_size": PCA_BLOCK_SIZE,
                "coefficients": stored_coefficients,
            },
            rel_l2,
            rank,
        )
        if rel_l2 <= target_rel_l2:
            break
    assert best is not None
    return best


def quantize_basis(basis: torch.Tensor, block_size: int) -> tuple[torch.Tensor, torch.Tensor]:
    if basis.ndim != 2 or block_size < 1:
        raise ValueError("PCA basis must be rank x elements and block size must be positive")
    blocks = (basis.shape[1] + block_size - 1) // block_size
    padded = torch.zeros((basis.shape[0], blocks * block_size), dtype=torch.float32)
    padded[:, : basis.shape[1]] = basis.float()
    grouped = padded.reshape(basis.shape[0], blocks, block_size)
    scale = grouped.abs().amax(dim=2).div(127).clamp_min(1e-12)
    quantized = grouped.div(scale[:, :, None]).round().clamp(-127, 127).to(torch.int8)
    return quantized.contiguous(), scale.to(torch.float16).contiguous()


def dequantize_basis(
    basis_q: torch.Tensor,
    basis_scale: torch.Tensor,
    *,
    elements: int,
    block_size: int,
) -> torch.Tensor:
    if basis_q.ndim != 3 or basis_q.shape[2] != block_size:
        raise ValueError("compact PCA basis block layout is inconsistent")
    decoded = basis_q.float() * basis_scale.float()[:, :, None]
    return decoded.reshape(basis_q.shape[0], -1)[:, :elements]


def reconstruct(payload: dict) -> list[list[torch.Tensor]]:
    """Decode a compact payload back into one list of tensors per denoising step."""
    codec = payload.get("codec")
    if codec not in {"temporal-pca-fp16-v1", "temporal-pca-int8-v1"}:
        raise ValueError(f"unsupported trajectory codec: {payload.get('codec')}")
    mean = payload["mean"].float()
    if codec == "temporal-pca-int8-v1":
        basis = dequantize_basis(
            payload["basis_q"],
            payload["basis_scale"],
            elements=int(payload["basis_elements"]),
            block_size=int(payload["basis_block_size"]),
        )
    else:
        basis = payload["basis"].float()
    coefficients = payload["coefficients"].float()
    flat_states = mean[None, :] + coefficients @ basis
    shapes = payload["state_shapes"]
    sizes = payload["state_sizes"]
    if sum(sizes) != flat_states.shape[1]:
        raise ValueError("compact trajectory tensor layout is inconsistent")
    decoded = []
    for flat in flat_states:
        tensors = []
        offset = 0
        for shape, size in zip(shapes, sizes, strict=True):
            tensors.append(flat[offset : offset + size].reshape(shape))
            offset += size
        decoded.append(tensors)
    return decoded


def compact_trace(
    trace: Path,
    *,
    target_rel_l2: float = 0.003,
    max_rank: int = 8,
    overwrite: bool = False,
) -> dict:
    manifest_path = trace / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("capture_status") != "completed" or manifest.get("capture_level") != "full":
        raise ValueError(f"not a completed full trajectory: {trace}")
    output = trace / "compact-pca.pt"
    if output.exists() and not overwrite:
        return dict(manifest.get("compact_trajectory") or {"file": output.name, "bytes": output.stat().st_size})
    states, shapes, sizes, source_files = load_states(trace)
    encoded, rel_l2, rank = temporal_pca(
        states,
        target_rel_l2=target_rel_l2,
        max_rank=max_rank,
    )
    if rel_l2 > target_rel_l2:
        raise ValueError(
            f"trajectory needs rank above {max_rank} to meet relative L2 target "
            f"({rel_l2:.6f} > {target_rel_l2:.6f}): {trace}"
        )
    payload = {
        "schema_version": 1,
        "codec": "temporal-pca-int8-v1",
        "rank": rank,
        "steps": int(states.shape[0]),
        "state_shapes": shapes,
        "state_sizes": sizes,
        "source_files": source_files,
        **encoded,
    }
    temp = output.with_suffix(".pt.tmp")
    torch.save(payload, temp)
    temp.replace(output)
    output.chmod(0o644)
    raw_state_bytes = sum((trace / name).stat().st_size for name in source_files)
    metadata = {
        "file": output.name,
        "codec": payload["codec"],
        "rank": rank,
        "steps": int(states.shape[0]),
        "relative_l2": rel_l2,
        "target_relative_l2": target_rel_l2,
        "target_met": True,
        "bytes": output.stat().st_size,
        "raw_state_bytes": raw_state_bytes,
        "state_compression_ratio": raw_state_bytes / max(output.stat().st_size, 1),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "raw_states_retained": True,
    }
    manifest["compact_trajectory"] = metadata
    manifest_temp = manifest_path.with_suffix(".json.tmp")
    manifest_temp.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    manifest_temp.replace(manifest_path)
    manifest_path.chmod(0o644)
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--limit", type=int, default=64)
    parser.add_argument("--target-rel-l2", type=float, default=0.003)
    parser.add_argument("--max-rank", type=int, default=8)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.limit <= 5000:
        raise SystemExit("--limit must be between 1 and 5000")
    if not 0 < args.target_rel_l2 < 1:
        raise SystemExit("--target-rel-l2 must be between 0 and 1")
    if not 1 <= args.max_rank <= 32:
        raise SystemExit("--max-rank must be between 1 and 32")
    completed = 0
    for manifest_path in sorted(args.root.glob("h3t-*/manifest.json")):
        if completed >= args.limit:
            break
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if manifest.get("capture_status") != "completed" or manifest.get("capture_level") != "full":
            continue
        metadata = compact_trace(
            manifest_path.parent,
            target_rel_l2=args.target_rel_l2,
            max_rank=args.max_rank,
            overwrite=args.overwrite,
        )
        completed += 1
        print(json.dumps({"trace_id": manifest.get("trace_id"), **metadata}, sort_keys=True), flush=True)
    print(json.dumps({"compacted": completed, "root": str(args.root)}, sort_keys=True))


if __name__ == "__main__":
    main()
