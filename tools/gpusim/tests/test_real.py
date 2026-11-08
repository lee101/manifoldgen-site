import pytest

from gpusim import real


def close(a, b, tol):
    return abs(a - b) / b <= tol


def test_fit_points():
    n = real.tokens(1344, 768, 124)
    assert n == real.N0 - 0 or abs(n - real.N0) < 600
    assert close(real.step_s("h100", "ck", real.N0), 7.02, 0.01)
    assert close(real.step_s("h100", "cudnn", real.N0), 6.13, 0.02)
    assert close(real.step_s("pro6000", "ck", real.N0), 6.0, 0.02)


def test_held_out_h100_15s():
    n = 108 * 1008 + real.PREFIX
    assert close(real.step_s("h100", "ck", n), 43.7, 0.05)


def test_held_out_pro6000_1080p_1440p():
    n1 = real.tokens(1920, 1088, 124)
    n2 = real.tokens(2528, 1440, 124)
    assert close(real.gen_s("pro6000", "ck", n1), 143.0, 0.06)
    assert close(real.gen_s("pro6000", "ck", n2), 367.0, 0.06)


def test_backend_choice():
    assert real.step_s("h100", "cudnn", real.N0) < real.step_s("h100", "ck", real.N0)
    assert real.step_s("pro6000", "ck", real.N0) < real.step_s("pro6000", "cudnn", real.N0)


def test_sparse_schedule_monotone():
    n = real.N0
    full = real.step_s("h100", "cudnn", n)
    late = real.step_s("h100", "cudnn", n, real.schedule(35, 0.15))
    assert late < full
