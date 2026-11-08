from __future__ import annotations

import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
import pytest

from motiontrack import job, ptbackend, ptfx

DX, DY = 2.0, 1.0


class FakeSparse:
    def tracks(self, frames, queries):
        T = len(frames)
        t = np.arange(T, dtype=np.float32)[:, None, None]
        pos = queries[None] + t * np.array([DX, DY], np.float32)
        return pos, np.ones(pos.shape[:2], bool)


class FakeDense:
    def flow_from_first(self, frames):
        T, h, w, _ = frames.shape
        f = np.zeros((T, h, w, 2), np.float16)
        f[..., 0] = np.arange(T)[:, None, None] * DX
        f[..., 1] = np.arange(T)[:, None, None] * DY
        return f, np.ones((T, h, w), np.float16)

    def consecutive_flow(self, frames):
        T, h, w, _ = frames.shape
        f = np.zeros((T - 1, h, w, 2), np.float16)
        f[..., 0], f[..., 1] = DX, DY
        return f, np.ones((T - 1, h, w), np.float16)


BACK = {"sparse": FakeSparse(), "dense": FakeDense()}


def make_video(path: Path, n: int = 24, w: int = 320, h: int = 192, audio: Path | None = None) -> Path:
    rng = np.random.default_rng(3)
    tex = cv2.GaussianBlur(rng.integers(0, 255, (h + 80, w + 80, 3), dtype=np.uint8), (0, 0), 2)
    raw = path.with_suffix(".raw.mp4")
    vw = cv2.VideoWriter(str(raw), cv2.VideoWriter_fourcc(*"mp4v"), 24, (w, h))
    for t in range(n):
        ox, oy = int(40 - t * DX), int(40 - t * DY)
        vw.write(tex[oy:oy + h, ox:ox + w].copy())
    vw.release()
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(raw)]
    if audio:
        cmd += ["-i", str(audio), "-shortest", "-c:a", "aac"]
    subprocess.run(cmd + ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "12", str(path)], check=True)
    return path


def make_wav(path: Path, seconds: float = 1.2) -> Path:
    sr = 22050
    t = np.arange(int(sr * seconds)) / sr
    x = 0.6 * np.sin(2 * np.pi * 70 * t) * (np.mod(t, 0.25) < 0.08) + 0.05 * np.sin(2 * np.pi * 440 * t)
    import wave

    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes((x * 32767).astype(np.int16).tobytes())
    return path


def read_all(path: Path) -> np.ndarray:
    cap = cv2.VideoCapture(str(path))
    out = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        out.append(fr)
    return np.stack(out)


@pytest.fixture(scope="module")
def vid(tmp_path_factory) -> Path:
    return make_video(tmp_path_factory.mktemp("pt") / "in.mp4")


def test_fill_smooth_interpolates_hidden_points():
    pos = np.zeros((10, 1, 2), np.float32)
    pos[:, 0, 0] = np.arange(10)
    vis = np.ones((10, 1), bool)
    vis[4:7] = False
    pos[4:7] = 99
    out = ptfx.fill_smooth(pos, vis, 0)
    assert np.allclose(out[:, 0, 0], np.arange(10), atol=1e-4)


def test_fit_quads_recovers_translation():
    q0 = ptfx.grid_queries((100, 80, 160, 140), 1.0, 320, 192)
    T = 6
    pos = q0[None] + np.arange(T)[:, None, None] * np.array([3.0, 1.0], np.float32)
    quads, frac = ptfx.fit_quads(q0, pos, np.ones((T, len(q0)), bool), ptfx.rect_corners((100, 80, 160, 140)), 1.0, 0)
    assert np.allclose(quads[5] - quads[0], [[15, 5]] * 4, atol=0.2)
    assert frac.min() == 1.0


def test_fit_quads_survives_dropouts():
    q0 = ptfx.grid_queries((100, 80, 160, 140), 1.0, 320, 192)
    T = 4
    pos = q0[None] + np.arange(T)[:, None, None] * np.array([2.0, 0.0], np.float32)
    vis = np.ones((T, len(q0)), bool)
    vis[2] = False
    vis[3, :3] = False
    quads, frac = ptfx.fit_quads(q0, pos, vis, ptfx.rect_corners((100, 80, 160, 140)), 0.5, 0)
    assert np.isfinite(quads).all()
    assert frac[2] == 0 and frac[3] < 1
    assert abs(quads[3, 0, 0] - quads[0, 0, 0] - 6) < 0.5


def test_splat_moves_a_box():
    m = np.zeros((60, 80), np.float32)
    m[20:40, 20:40] = 1
    flow = np.zeros((60, 80, 2), np.float32)
    flow[..., 0] = 10
    flow[..., 1] = 5
    out = ptfx.splat(m, flow)
    ys, xs = np.where(out > 0.5)
    assert abs(xs.mean() - 39.5) < 1.0 and abs(ys.mean() - 34.5) < 1.0
    assert abs(out.sum() - m.sum()) < 40


def test_splat_ignores_low_confidence():
    m = np.ones((30, 30), np.float32)
    flow = np.zeros((30, 30, 2), np.float32)
    conf = np.zeros((30, 30), np.float32)
    assert ptfx.splat(m, flow, conf).max() >= 0


def test_parse_rect_forms_and_errors():
    assert ptfx.parse_rect({"region": {"x": 0.1, "y": 0.2, "w": 0.3, "h": 0.4}}, 100, 100) == pytest.approx((10.0, 20.0, 40.0, 60.0))
    r = ptfx.parse_rect({"point": {"x": 0.5, "y": 0.5, "radius": 0.1}}, 200, 100)
    assert r[0] == pytest.approx(80) and r[2] == pytest.approx(120)
    with pytest.raises(ptfx.BadInput):
        ptfx.parse_rect({}, 100, 100)
    with pytest.raises(ptfx.BadInput):
        ptfx.parse_rect({"region": {"x": 0.999, "y": 0.0, "w": 0.5, "h": 0.5}}, 100, 100)


def test_blur_region_follows_tracked_motion(vid, tmp_path):
    p = {"region": {"x": 0.3, "y": 0.3, "w": 0.3, "h": 0.4}, "style": "blur", "strength": 2.0, "max_side": 320, "track_side": 320}
    m = ptfx.run("track-blur", str(vid), tmp_path / "o", p, backends=BACK)
    assert m["ok"] and m["mode"] == "region" and m["tracked_visible"] == 1.0
    src, out = read_all(vid), read_all(tmp_path / "o" / "result.mp4")
    assert out.shape == src.shape
    lap = lambda f, x0, y0, x1, y1: cv2.Laplacian(cv2.cvtColor(f[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY), cv2.CV_32F).var()
    last = len(src) - 1
    ox, oy = int(DX * last), int(DY * last)
    inside = (110 + ox, 70 + oy, 140 + ox, 100 + oy)
    assert lap(out[last], *inside) < 0.35 * lap(src[last], *inside)
    assert lap(out[last], 10, 150, 60, 185) > 0.5 * lap(src[last], 10, 150, 60, 185)


@pytest.mark.parametrize("style", ["pixelate", "solid"])
def test_blur_styles_and_invert(vid, tmp_path, style):
    p = {"point": {"x": 0.5, "y": 0.5, "radius": 0.12}, "style": style, "invert": style == "solid", "max_side": 320, "track_side": 320, "max_seconds": 0.5}
    ptfx.run("track-blur", str(vid), tmp_path / "o", p, backends=BACK)
    out = read_all(tmp_path / "o" / "result.mp4")
    assert out.shape[0] >= 10
    if style == "solid":
        assert out[0][5, 5].max() < 30


def test_blur_with_propagated_mask(vid, tmp_path):
    m = np.zeros((192, 320), np.uint8)
    m[60:130, 100:180] = 255
    cv2.imwrite(str(tmp_path / "m.png"), m)
    r = ptfx.run("track-blur", str(vid), tmp_path / "o", {"mask_path": str(tmp_path / "m.png"), "max_side": 320, "track_side": 320}, backends=BACK)
    assert r["mode"] == "mask"
    assert (tmp_path / "o" / "result.mp4").exists()


def test_sticky_overlay_tracks_and_warps(vid, tmp_path):
    p = {"text": "HIT", "x": 0.45, "y": 0.5, "width": 0.3, "max_side": 320, "track_side": 320, "pop": False, "fade": 0}
    r = ptfx.run("sticky-overlay", str(vid), tmp_path / "o", p, backends=BACK)
    assert r["ok"] and r["width"] == 320
    src, out = read_all(vid), read_all(tmp_path / "o" / "result.mp4")
    cent = lambda i: np.array(np.where(np.abs(out[i].astype(int) - src[i].astype(int)).sum(-1) > 90)[::-1]).mean(axis=1)
    shift = cent(len(src) - 1) - cent(0)
    last = len(src) - 1
    assert abs(shift[0] - DX * last) < 3.5 and abs(shift[1] - DY * last) < 3.5


def test_sticky_overlay_image_and_errors(vid, tmp_path):
    spr = np.zeros((40, 80, 4), np.uint8)
    spr[..., 2], spr[..., 3] = 255, 255
    cv2.imwrite(str(tmp_path / "s.png"), spr)
    ptfx.run("sticky-overlay", str(vid), tmp_path / "o", {"image_path": str(tmp_path / "s.png"), "rotation": 15, "max_side": 320, "max_seconds": 0.5}, backends=BACK)
    assert (tmp_path / "o" / "poster.jpg").exists()
    with pytest.raises(ptfx.BadInput):
        ptfx.run("sticky-overlay", str(vid), tmp_path / "o2", {"max_side": 320}, backends=BACK)


def test_mask_propagate_follows_object(vid, tmp_path):
    p = {"region": {"x": 0.2, "y": 0.25, "w": 0.3, "h": 0.4}, "max_side": 320, "track_side": 320, "segment": 8}
    r = ptfx.run("mask-propagate", str(vid), tmp_path / "o", p, backends=BACK)
    assert r["mask"] == "mask.mp4" and abs(r["area_last"] - r["area_first"]) < 0.02
    mk = read_all(tmp_path / "o" / "mask.mp4")[..., 0]
    cx = lambda m: np.where(m > 127)[1].mean()
    assert abs((cx(mk[-1]) - cx(mk[0])) - DX * (len(mk) - 1)) < 4
    z = np.load(tmp_path / "o" / "masks.npz")
    assert tuple(z["shape"])[0] == len(mk)


@pytest.mark.parametrize("effects", [["motion-blur"], ["jelly"], ["trails"], ["flow-color"], ["motion-blur", "trails", "jelly"]])
def test_flow_fx_effects(vid, tmp_path, effects):
    r = ptfx.run("flow-fx", str(vid), tmp_path / "o", {"effects": effects, "max_side": 320, "track_side": 320, "strength": 1.2}, backends=BACK)
    assert r["effects"] == effects and 1.5 < r["mean_motion_px"] < 3.0
    src, out = read_all(vid), read_all(tmp_path / "o" / "result.mp4")
    assert out.shape == src.shape
    assert np.abs(out.astype(int) - src.astype(int)).mean() > 0.5


def test_flow_fx_unknown_effect_falls_back(vid, tmp_path):
    r = ptfx.run("flow-fx", str(vid), tmp_path / "o", {"effects": ["nope"], "max_side": 320, "max_seconds": 0.5}, backends=BACK)
    assert r["effects"] == ["motion-blur"]


def test_reactive_fx_uses_audio(tmp_path):
    wav = make_wav(tmp_path / "a.wav", 6.0)
    vid = make_video(tmp_path / "v.mp4", n=48)
    r = ptfx.run("reactive-fx", str(vid), tmp_path / "o", {"max_side": 320, "track_side": 320, "intensity": 1.2}, audio=str(wav), backends=BACK)
    assert r["ok"] and r["kicks"] > 0
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", str(tmp_path / "o" / "result.mp4")], capture_output=True, text=True).stdout
    assert "audio" in probe
    src, out = read_all(vid), read_all(tmp_path / "o" / "result.mp4")
    assert np.abs(out.astype(int) - src.astype(int)).mean() > 0.5


def test_reactive_fx_without_audio_is_bad_input(vid, tmp_path):
    with pytest.raises(ptfx.BadInput):
        ptfx.run("reactive-fx", str(vid), tmp_path / "o", {"max_side": 320}, backends=BACK)


def test_unknown_tool_and_unreadable_video(tmp_path):
    bad = tmp_path / "x.mp4"
    bad.write_bytes(b"nope")
    with pytest.raises(ptfx.BadInput):
        ptfx.run("flow-fx", str(bad), tmp_path / "o", {}, backends=BACK)


def test_backend_missing_weights_is_clean(monkeypatch, tmp_path):
    monkeypatch.setenv("MOTIONTRACK_CKPT_DIR", str(tmp_path))
    monkeypatch.setenv("MOTIONTRACK_HOME", str(tmp_path))
    with pytest.raises(ptbackend.BackendUnavailable) as e:
        ptbackend.load_dense()
    assert "torch" in str(e.value) or "not found" in str(e.value)


def test_job_contract_for_pt_tools(vid, tmp_path, monkeypatch):
    monkeypatch.setenv("MOTIONTRACK_CKPT_DIR", str(tmp_path / "none"))
    monkeypatch.setenv("MOTIONTRACK_HOME", str(tmp_path / "none"))
    out = tmp_path / "job"
    args = {"tool": "track-blur", "video": str(vid), "out": str(out), "params": {}}
    (tmp_path / "a.json").write_text(json.dumps(args))
    assert job.main([str(tmp_path / "a.json")]) == 2
    man = json.loads((out / "manifest.json").read_text())
    assert not man["ok"] and "region" in man["error"]
    args["params"] = {"region": {"x": 0.3, "y": 0.3, "w": 0.2, "h": 0.2}}
    (tmp_path / "a.json").write_text(json.dumps(args))
    code = job.main([str(tmp_path / "a.json")])
    man = json.loads((out / "manifest.json").read_text())
    assert code == 1 and not man["ok"]


def test_tool_list_matches_job():
    assert set(ptfx.TOOLS) == set(job.PT_TOOLS)
