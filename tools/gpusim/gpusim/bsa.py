import torch
import triton
import triton.language as tl


@triton.jit
def _fwd(Q, K, V, O, KV_IDX, KV_CNT, sm_scale, N, H, NQB, MAXK,
         stride_bh, stride_n,
         BM: tl.constexpr, BN: tl.constexpr, D: tl.constexpr):
    pid_m = tl.program_id(0)
    pid_bh = tl.program_id(1)
    head = pid_bh % H
    base = pid_bh * stride_bh
    offs_m = pid_m * BM + tl.arange(0, BM)
    offs_d = tl.arange(0, D)
    q = tl.load(Q + base + offs_m[:, None] * stride_n + offs_d[None, :], mask=offs_m[:, None] < N, other=0.0)
    q = (q * sm_scale).to(q.dtype)
    m_i = tl.full([BM], -float("inf"), tl.float32)
    l_i = tl.zeros([BM], tl.float32)
    acc = tl.zeros([BM, D], tl.float32)
    row = (head * NQB + pid_m)
    cnt = tl.load(KV_CNT + row)
    for j in range(0, cnt):
        kb = tl.load(KV_IDX + row * MAXK + j)
        offs_n = kb * BN + tl.arange(0, BN)
        nmask = offs_n < N
        k = tl.load(K + base + offs_n[None, :] * stride_n + offs_d[:, None], mask=nmask[None, :], other=0.0)
        s = tl.dot(q, k)
        s = tl.where(nmask[None, :], s, -float("inf"))
        m_new = tl.maximum(m_i, tl.max(s, 1))
        p = tl.exp(s - m_new[:, None])
        alpha = tl.exp(m_i - m_new)
        l_i = l_i * alpha + tl.sum(p, 1)
        v = tl.load(V + base + offs_n[:, None] * stride_n + offs_d[None, :], mask=nmask[:, None], other=0.0)
        acc = acc * alpha[:, None] + tl.dot(p.to(v.dtype), v)
        m_i = m_new
    acc = acc / l_i[:, None]
    tl.store(O + base + offs_m[:, None] * stride_n + offs_d[None, :], acc.to(O.dtype.element_ty), mask=offs_m[:, None] < N)


def block_sparse_attention(q, k, v, kv_idx, kv_cnt, bm=128, bn=64, num_warps=4, num_stages=2):
    b, h, n, d = q.shape
    assert q.is_contiguous() and k.is_contiguous() and v.is_contiguous()
    o = torch.empty_like(q)
    nqb = triton.cdiv(n, bm)
    assert kv_idx.shape[:2] == (h, nqb) and kv_cnt.shape == (h, nqb)
    grid = (nqb, b * h)
    _fwd[grid](q, k, v, o, kv_idx, kv_cnt, d ** -0.5, n, h, nqb, kv_idx.shape[2],
               q.stride(1), q.stride(2), BM=bm, BN=bn, D=d, num_warps=num_warps, num_stages=num_stages)
    return o


def to_csr(mask, maxk=None):
    cnt = mask.sum(-1).to(torch.int32)
    mk = int(cnt.max().item()) if maxk is None else maxk
    order = torch.argsort(mask.to(torch.int8), dim=-1, descending=True, stable=True)[..., :mk]
    return order.to(torch.int32).contiguous(), cnt.contiguous()


def dense_reference(q, k, v, mask, bm, bn):
    h, nqb, nkb = mask.shape
    n = q.shape[2]
    full = mask.repeat_interleave(bm, 1).repeat_interleave(bn, 2)[:, :n, :n]
    return torch.nn.functional.scaled_dot_product_attention(q, k, v, attn_mask=full.unsqueeze(0))
