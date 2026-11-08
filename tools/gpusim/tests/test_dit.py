import pytest

from gpusim import dit, specs


@pytest.mark.parametrize("tc", [4, 8])
def test_h100_fit_reproduces_measurements(tc):
    for name, key in (("5s-768p", "5s-768p"), ("15s-768p", "15s-768p")):
        c = dit.clip(name, tc)
        got = dit.clip_seconds("h100", c, tc=tc)
        want = dit.MEASURED[("h100", key)][1]
        assert got == pytest.approx(want, rel=1e-6)


@pytest.mark.parametrize("tc", [4, 8])
def test_attention_fraction_in_range(tc):
    for g in ("h100", "pro6000"):
        a, b = dit.coeffs(g, tc)
        f = dit.attn_fraction(a, b, dit.clip("5s-768p", tc).tokens)
        assert 0 < f < 1


def test_sparse_never_slower_when_rho_below_one():
    c = dit.clip("15s-768p")
    for g in specs.GPUS:
        assert dit.clip_seconds(g, c, rho=0.3) < dit.clip_seconds(g, c)


def test_tokens():
    c = dit.clip("5s-768p", 8)
    assert c.lat_h == 48 and c.lat_w == 84
