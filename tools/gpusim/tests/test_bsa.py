import pytest
import torch

from gpusim import bsa, patterns, synth

cuda = pytest.mark.skipif(not torch.cuda.is_available(), reason="cuda")
LF, LH, LW = 8, 24, 32


def run(mask, q, k, v, bm=128, bn=64):
    idx, cnt = bsa.to_csr(mask)
    out = bsa.block_sparse_attention(q, k, v, idx.cuda(), cnt.cuda(), bm, bn)
    ref = bsa.dense_reference(q, k, v, mask, bm, bn)
    return out.float(), ref.float()


def data(heads=2):
    return synth.qkv(LF, LH, LW, heads, seed=3)


@cuda
def test_full_mask_matches_sdpa():
    q, k, v = data()
    n = q.shape[2]
    mask = torch.ones(2, n // 128, n // 64, dtype=torch.bool, device="cuda")
    out, ref = run(mask, q, k, v)
    assert (out - ref).abs().max() < 2e-2


@cuda
@pytest.mark.parametrize("name", ["sliding", "radial"])
def test_static_patterns_match_masked_reference(name):
    q, k, v = data()
    if name == "sliding":
        m = patterns.sliding(LF, LH, LW, 128, 64, wf=1, wy=3)
    else:
        m = patterns.radial(LF, LH, LW, 128, 64, base=0.08)
    m = m.unsqueeze(0).repeat(2, 1, 1).cuda()
    assert 0 < patterns.density(m) < 1
    out, ref = run(m, q, k, v)
    assert (out - ref).abs().max() < 2e-2


@cuda
def test_topk_matches_masked_reference_and_finite():
    q, k, v = data()
    m = patterns.topk(q, k, 128, 64, keep=6)
    out, ref = run(m, q, k, v)
    assert (out - ref).abs().max() < 2e-2
    assert torch.isfinite(out).all()


@cuda
def test_non_multiple_length():
    q, k, v = synth.qkv(3, 10, 13, 1, seed=1)
    n = q.shape[2]
    nqb, nkb = -(-n // 128), -(-n // 64)
    mask = torch.ones(1, nqb, nkb, dtype=torch.bool, device="cuda")
    out, ref = run(mask, q, k, v)
    assert (out - ref).abs().max() < 2e-2
