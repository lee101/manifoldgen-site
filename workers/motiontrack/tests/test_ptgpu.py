import numpy as np
import pytest

torch = pytest.importorskip("torch")
if not torch.cuda.is_available():
    pytest.skip("needs a GPU", allow_module_level=True)

from motiontrack import ptfx, ptgpu


def scene(W=320, H=180):
    rng = np.random.default_rng(3)
    img = cv2_blur((rng.random((H, W, 3)) * 255).astype(np.uint8))
    flow = np.zeros((H // 2, W // 2, 2), np.float16)
    flow[..., 0] = 3.0
    flow[20:60, 30:90, 1] = -2.0
    return img, flow


def cv2_blur(a):
    import cv2

    return cv2.GaussianBlur(a, (0, 0), 3)


class C:
    W, H, sx, sy = 320, 180, 2.0, 2.0


def test_blur_matches_cv2():
    import cv2

    a = np.random.default_rng(1).random((90, 120, 3)).astype(np.float32)
    ref = cv2.GaussianBlur(a, (0, 0), 4)
    got = ptgpu.blur(torch.from_numpy(a).permute(2, 0, 1)[None].cuda(), 4)[0].permute(1, 2, 0).cpu().numpy()
    assert np.abs(ref - got).mean() < 2e-3


def test_motion_blur_matches_cpu():
    img, flow = scene()
    cv = ptgpu.Canvas(320, 180, 2.0, 2.0)
    g = cv.out(cv.motion_blur(cv.image(img), cv.flow(flow), 1.0)).astype(np.float32)
    up = ptfx.up_flow(flow, C)
    gx, gy = ptfx._grid(C)
    ref = ptfx.motion_blur(img, up, gx, gy, 1.0)
    assert np.abs(g - ref).mean() < 1.5


def test_jelly_and_trails_match_cpu_over_frames():
    img, flow = scene()
    cv = ptgpu.Canvas(320, 180, 2.0, 2.0)
    gx, gy = ptfx._grid(C)
    cj, gj = ptfx.Jelly(C, 1.0), ptgpu.Jelly(cv, 1.0)
    ct, gt = ptfx.FlowTrails(C, (0.2, 0.6, 1.0), 0.9), ptgpu.Trails(cv, (0.2, 0.6, 1.0), 0.9)
    up, gf = ptfx.up_flow(flow, C), cv.flow(flow)
    for _ in range(6):
        a = cv.out(gj.step(cv.image(img), gf)).astype(np.float32)
        b = cj.step(img, up, gx, gy).astype(np.float32)
        assert np.abs(a - b).mean() < 2.0
        a = cv.out(gt.step(cv.image(img), gf, gf, 0.8)).astype(np.float32)
        b = ct.step(img, up, up, gx, gy, 0.8)
        assert np.abs(a - b).mean() < 2.5


def test_flow_color_matches_cpu():
    img, flow = scene()
    cv = ptgpu.Canvas(320, 180, 2.0, 2.0)
    up = ptfx.up_flow(flow, C)
    a = cv.out(cv.flow_color(cv.image(img), cv.flow(flow), 0.6)).astype(np.float32)
    b = ptfx.flow_color(img, up, 0.6)
    assert np.abs(a - b).mean() < 2.5


def test_splat_matches_cpu():
    rng = np.random.default_rng(5)
    mask = np.zeros((90, 160), np.float32)
    mask[20:60, 40:100] = 1
    flow = (rng.random((90, 160, 2)) * 6 - 3).astype(np.float16)
    conf = np.ones((90, 160), np.float16)
    a = ptfx.splat(mask, flow, conf)
    b = ptfx.splat(mask, flow, conf, "cuda")
    assert np.abs(a - b).mean() < 0.02
