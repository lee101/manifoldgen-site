import json
import subprocess
from pathlib import Path

import numpy as np
import pytest

from motiontrack import beats, retime, sfx
from motiontrack.bytetrack import ByteTracker, iou_matrix
from motiontrack.signals import analyze, combos
from motiontrack.track import Track, TrackSet

FPS = 24.0


def _person(tid, n, x0, kick_at=None, w=1280, h=704):
    kp = np.zeros((n, 17, 2), np.float32)
    cx = np.full(n, x0, np.float32)
    for j in range(17):
        kp[:, j, 0] = cx + (j % 5 - 2) * 8
        kp[:, j, 1] = 150 + j * 18
    if kick_at is not None:
        for i in range(n):
            d = i - kick_at
            if -3 <= d <= 0:
                kp[i, 16, 0] += (3 + d) * 90
    box = np.zeros((n, 4), np.float32)
    box[:, 0], box[:, 1], box[:, 2], box[:, 3] = cx - 70, 130, cx + 70, 480
    return Track(tid, 0, kp, np.ones((n, 17), np.float32), box, np.ones(n, bool))


def _set():
    ts = TrackSet(FPS, 1280, 704, 96)
    ts.tracks = [_person(1, 96, 400, kick_at=40), _person(2, 96, 700)]
    ts.tracks[0].kp[:, 16, 0] = ts.tracks[0].kp[:, 16, 0]
    return ts


def test_iou_and_tracker_keeps_identity():
    a = np.array([[0, 0, 10, 10]], np.float32)
    assert iou_matrix(a, a)[0, 0] == pytest.approx(1.0)
    tr = ByteTracker(buffer=10)
    ids = []
    for f in range(12):
        boxes = np.array([[10 + f, 10, 60 + f, 110], [300 - f, 10, 350 - f, 110]], np.float32)
        out = dict((j, t) for t, j in tr.update(boxes, np.array([0.9, 0.9], np.float32)))
        ids.append((out.get(0), out.get(1)))
    assert ids[-1][0] != ids[-1][1]
    assert len({i[0] for i in ids[3:]}) == 1 and len({i[1] for i in ids[3:]}) == 1


def test_tracker_recovers_after_gap():
    tr = ByteTracker(buffer=20)
    box = np.array([[10, 10, 60, 110]], np.float32)
    first = None
    for f in range(6):
        out = tr.update(box + f, np.array([0.9], np.float32))
        first = first or (out[0][0] if out else None)
    for _ in range(4):
        tr.update(np.zeros((0, 4), np.float32), np.zeros(0, np.float32))
    out = tr.update(box + 10, np.array([0.9], np.float32))
    assert out and out[0][0] == first


def test_trackset_roundtrip(tmp_path):
    ts = _set()
    p = tmp_path / "t.json"
    ts.save(p)
    back = TrackSet.load(p)
    assert len(back.tracks) == 2 and back.frames == 96
    assert np.allclose(back.tracks[0].kp, ts.tracks[0].kp, atol=0.1)


def test_events_find_the_kick_and_target():
    ts = _set()
    ts.tracks[0].kp[40:, 16, 0] = ts.tracks[1].kp[40:, 11, 0]
    sig = analyze(ts)
    assert sig.events, "kick should be detected"
    e = max(sig.events, key=lambda e: e.power)
    assert e.track == 1 and e.joint == 16 and abs(e.frame - 40) <= 4
    assert sig.energy.max() > 0.5


def test_combo_resets_after_idle():
    from motiontrack.signals import Event

    ev = [Event(10, 0.4, 1, 16, 0, 0, 3, "impact", 2, 1), Event(20, 0.8, 1, 16, 0, 0, 3, "impact", 2, 1), Event(100, 4.2, 1, 16, 0, 0, 3, "impact", 2, 1)]
    assert [c[2] for c in combos(ev)] == [1, 2, 1]


def test_retime_plan_slows_and_conserves_range():
    pos, spd = retime.plan(120, FPS, [2.0])
    assert len(pos) > 120 and spd.min() < 0.3 and pos[-1] <= 119
    assert np.all(np.diff(pos) >= 0)
    segs = retime.segments(pos, spd, FPS)
    assert segs[0][0] == 0 and all(0.2 <= s[2] <= 1.0 for s in segs)
    assert "atempo=0.5" in retime.atempo_chain(0.25)
    pos1, spd1 = retime.plan(120, FPS, [])
    assert len(pos1) == 120 and spd1.max() == 1.0


def test_sfx_mix_places_energy_at_event():
    mix = sfx.mix_events(2.0, [("impact", 1.0, 1.0, 0.0)])
    assert mix.shape == (int(sfx.SR * 2.0), 2)
    pre, post = np.abs(mix[: int(sfx.SR * 0.7)]).max(), np.abs(mix[int(sfx.SR * 1.0): int(sfx.SR * 1.1)]).max()
    assert post > 5 * max(pre, 1e-6) and np.abs(mix).max() <= 1.0


def test_beats_detects_tempo_and_kicks():
    sr, bpm, dur = beats.SR, 120.0, 12.0
    x = np.zeros(int(sr * dur), np.float32)
    k = sfx.kick()
    kk = np.interp(np.arange(len(k)) * sr / sfx.SR, np.arange(len(k)), k).astype(np.float32)
    for b in np.arange(0, dur - 0.5, 60 / bpm):
        i = int(b * sr)
        x[i:i + len(kk)] += kk[: len(x) - i]
    f = beats.analyze_audio(x)
    assert abs(f.bpm - bpm) < 4 or abs(f.bpm - bpm / 2) < 3 or abs(f.bpm - bpm * 2) < 6
    assert len(f.kicks) >= 15


def test_job_bad_input(tmp_path):
    from motiontrack import job

    args = {"tool": "beat-drop", "video": str(tmp_path / "missing.mp4"), "out": str(tmp_path / "o"), "params": {}}
    p = tmp_path / "a.json"
    p.write_text(json.dumps(args))
    assert job.main([str(p)]) == 2
    assert json.loads((tmp_path / "o" / "manifest.json").read_text())["ok"] is False


def test_render_with_synthetic_tracks_and_no_models(tmp_path):
    ffmpeg = subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=640x352:rate=24:duration=4", "-pix_fmt", "yuv420p", str(tmp_path / "in.mp4")])
    assert ffmpeg.returncode == 0
    ts = TrackSet(24.0, 640, 352, 96)
    sc = 0.5
    ts.tracks = []
    for t in (_person(1, 96, 200, kick_at=40), _person(2, 96, 380)):
        t.kp *= sc
        t.box *= sc
        ts.tracks.append(t)
    ts.tracks[0].kp[40:, 16, 0] = ts.tracks[1].kp[40:, 11, 0]
    ts.save(tmp_path / "tr.json")
    from motiontrack import render as R

    for preset in ("anime-fight", "game-hud", "spotlight", "tracking-overlay", "track-guide"):
        m = R.render(str(tmp_path / "in.mp4"), str(tmp_path / f"{preset}.mp4"), preset, tracks=str(tmp_path / "tr.json"), max_side=640, log=lambda *_: None)
        assert Path(m["output"]).stat().st_size > 5000 and m["frames"] >= 96


def _video(tmp_path, seconds=4, size="640x352"):
    path = tmp_path / "in.mp4"
    cmd = ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"testsrc=size={size}:rate=24:duration={seconds}",
           "-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}", "-pix_fmt", "yuv420p", "-shortest", str(path)]
    assert subprocess.run(cmd).returncode == 0
    return path


def _tracks(tmp_path, n=96):
    ts = TrackSet(24.0, 640, 352, n)
    for t in (_person(1, n, 200, kick_at=40), _person(2, n, 380)):
        t.kp *= 0.5
        t.box *= 0.5
        ts.tracks.append(t)
    ts.tracks[0].kp[40:, 16, 0] = ts.tracks[1].kp[40:, 11, 0]
    path = tmp_path / "tr.json"
    ts.save(path)
    return path


def _music(tmp_path, seconds=12):
    path = tmp_path / "song.wav"
    expr = "aevalsrc='sin(2*PI*55*t)*exp(-8*mod(t,0.5))+0.3*sin(2*PI*3000*t)*exp(-30*mod(t+0.25,0.5))':d=%d:s=44100" % seconds
    assert subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", expr, str(path)]).returncode == 0
    return path


@pytest.mark.parametrize("preset", ["anime-fight", "ki-aura", "lightning", "neon-trails", "game-hud", "spotlight", "slowmo-impacts", "exaggerate", "echo"])
def test_every_public_preset_renders(tmp_path, preset):
    from motiontrack import render as R

    video, tr = _video(tmp_path), _tracks(tmp_path)
    m = R.render(str(video), str(tmp_path / "o.mp4"), preset, tracks=str(tr), max_side=480, names=["A", "B"], log=lambda *_: None)
    assert Path(m["output"]).stat().st_size > 3000
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", m["output"]], capture_output=True, text=True).stdout
    assert "video" in probe and ("audio" in probe) == m["audio"]


def test_exaggerate_moves_pixels_near_fast_joint(tmp_path):
    from motiontrack import fx

    ts = _tracks(tmp_path)
    ts = TrackSet.load(ts)
    ctx = fx.Ctx(ts, analyze(ts), 640, 352, 24.0, intensity=1.5)
    field = fx.whip_field(ctx, 40.0, 3.0)
    assert field is not None and field.shape == (352, 640, 2)
    assert np.abs(field).max() > 1.0
    calm = fx.whip_field(ctx, 10.0, 3.0)
    assert calm is None or np.abs(calm).max() < np.abs(field).max()
    src = np.random.default_rng(1).random((352, 640, 3)).astype(np.float32)
    L = fx.Layers.new(src.copy())
    fx.fx_exaggerate(ctx, L, 40.0, 40)
    assert L.base.shape == src.shape and not np.allclose(L.base, src)


def test_echo_adds_light_only_where_ghosts_are(tmp_path):
    from motiontrack import fx

    ts = TrackSet.load(_tracks(tmp_path))
    ctx = fx.Ctx(ts, analyze(ts), 640, 352, 24.0)
    L = fx.Layers.new(np.zeros((352, 640, 3), np.float32))
    fx.fx_echo(ctx, L, 30.0, 30)
    assert L.add.max() > 0 and (L.add.sum(axis=2) > 0).mean() < 0.3
    L2 = fx.Layers.new(np.zeros((352, 640, 3), np.float32))
    fx.fx_echo(ctx, L2, 1.0, 1)
    assert L2.add.max() == 0


def test_beat_drop_with_song_and_start_offset(tmp_path):
    from motiontrack import render as R

    video, song = _video(tmp_path), _music(tmp_path)
    m = R.render(str(video), str(tmp_path / "bd.mp4"), "beat-drop", reactive_audio=str(song), audio_start=2.0, max_side=480, log=lambda *_: None)
    assert m["audio"] and m["audio_bpm"] and m["tracks"] == 0
    vol = subprocess.run(["ffmpeg", "-i", m["output"], "-af", "volumedetect", "-vn", "-f", "null", "-"], capture_output=True, text=True).stderr
    assert "max_volume" in vol and float(vol.split("max_volume:")[1].split("dB")[0]) > -6


def test_job_tools_with_cached_tracks(tmp_path):
    from motiontrack import job

    video, song = _video(tmp_path), _music(tmp_path)
    for tool, extra in (("motion-fx", {"params": {"preset": "echo", "intensity": 1.2, "palette": "ice", "names": ["Ann", "Bo"], "extra": ["trails", "bogus"]}}),
                        ("motion-track", {}), ("motion-score", {"music": str(song), "params": {"keep_audio": True}}),
                        ("beat-drop", {"audio": str(song), "params": {"audio_start": 1}})):
        out = tmp_path / tool
        out.mkdir()
        (out / "tracks.json").write_text(_tracks(tmp_path).read_text())
        args = {"tool": tool, "video": str(video), "out": str(out), "params": {}, **extra}
        a = tmp_path / f"{tool}.json"
        a.write_text(json.dumps(args))
        assert job.main([str(a)]) == 0, tool
        m = json.loads((out / "manifest.json").read_text())
        assert m["ok"] and (out / (m.get("video") or m["preview"])).stat().st_size > 1000
        if tool == "motion-track":
            sig = json.loads((out / "signals.json").read_text())
            assert sig["events"] and sig["intensity"] and (out / "guide.mp4").exists()
        if tool == "motion-score":
            assert (out / "result.wav").exists() and json.loads((out / "cues.json").read_text())["prompt"].endswith("hits on beat")


@pytest.mark.parametrize("args,code", [({"tool": "motion-fx", "params": {"preset": "nope"}}, 2), ({"tool": "wat"}, 2), ({"tool": "beat-drop"}, 2)])
def test_job_rejects_bad_requests(tmp_path, args, code):
    from motiontrack import job

    video = _video(tmp_path)
    full = {"video": str(video), "out": str(tmp_path / "o"), "params": {}, **args}
    a = tmp_path / "a.json"
    a.write_text(json.dumps(full))
    (tmp_path / "o").mkdir()
    (tmp_path / "o" / "tracks.json").write_text(_tracks(tmp_path).read_text())
    assert job.main([str(a)]) == code
    assert json.loads((tmp_path / "o" / "manifest.json").read_text())["ok"] is False


def test_track_video_with_stub_detector_and_id_stitching(tmp_path, monkeypatch):
    from motiontrack import track

    video = _video(tmp_path, seconds=3)

    class Stub:
        def __init__(self, *a, **k):
            self.n = 0

        def __call__(self, frame):
            f = self.n
            self.n += 1
            if 30 <= f < 33:
                return (np.zeros((0, 4), np.float32), np.zeros((0, 17, 2), np.float32), np.zeros((0, 17), np.float32), np.zeros(0, np.float32))
            x = 100 + f * 2
            box = np.array([[x, 50, x + 60, 250]], np.float32)
            kp = np.stack([np.linspace(x, x + 60, 17), np.linspace(60, 240, 17)], axis=1)[None].astype(np.float32)
            return box, kp, np.full((1, 17), 0.9, np.float32), np.ones(1, np.float32)

    monkeypatch.setattr(track, "Pose", Stub)
    ts = track.track_video(str(video), max_side=640, min_len=4)
    assert len(ts.tracks) == 1 and ts.tracks[0].valid.sum() >= 60
    assert track.smooth_series(np.zeros((2, 3)), np.array([True, False]), 1.0).shape == (2, 3)


def test_score_music_fit_changes_tempo_and_ducks(tmp_path):
    from motiontrack import score
    from motiontrack.signals import Event, Signals

    music = _music(tmp_path, 14)
    sig = Signals(24.0, 96, np.linspace(0, 1, 96).astype(np.float32), {}, {}, [Event(40, 1.67, 1, 16, 0, 0, 3.0, "impact", 2, 1.0)], 112.0, [0.2 + 0.536 * i for i in range(7)])
    fitted, info = score.fit_music(str(music), sig, 4.0)
    assert fitted.shape == (int(4.0 * 44100), 2) and info["music_bpm"] > 0
    ducked = score.duck(np.ones((44100 * 4, 2), np.float32), sig)
    assert ducked.min() < 0.7 and ducked[:1000].min() == 1.0
    assert "112 BPM" in score.music_prompt(sig, "dark")


def test_cli_presets_fx_and_track(tmp_path, capsys, monkeypatch):
    from motiontrack import cli
    from motiontrack import render as R

    assert cli.main(["presets"]) == 0
    listed = json.loads(capsys.readouterr().out)
    assert "exaggerate" in listed and "tracking-overlay" not in listed and all(v["blurb"] for v in listed.values())
    video, tr = _video(tmp_path), _tracks(tmp_path)
    out, manifest = tmp_path / "cli.mp4", tmp_path / "m.json"
    rc = cli.main(["fx", str(video), str(out), "--preset", "echo", "--tracks", str(tr), "--slowmo", "off", "--sfx", "on", "--text", "off",
                   "--names", "A,B", "--extra", "trails", "--max-side", "480", "--manifest", str(manifest)])
    assert rc == 0 and out.exists() and json.loads(manifest.read_text())["preset"] == "echo"
    monkeypatch.setattr(R, "get_tracks", lambda *a, **k: TrackSet.load(tr))
    assert cli.main(["track", str(video), str(tmp_path / "t.json")]) == 0
    assert (tmp_path / "t.signals.json").exists()
    a = tmp_path / "a.json"
    (tmp_path / "jo").mkdir()
    (tmp_path / "jo" / "tracks.json").write_text(tr.read_text())
    a.write_text(json.dumps({"tool": "motion-track", "video": str(video), "out": str(tmp_path / "jo"), "params": {}}))
    assert cli.main(["job", str(a)]) == 0


def test_interpolator_blends_between_frames():
    a = np.zeros((64, 96, 3), np.uint8)
    b = np.zeros((64, 96, 3), np.uint8)
    a[20:40, 10:30] = 255
    b[20:40, 30:50] = 255
    it = retime.Interpolator()
    assert it.at(a, b, 0, 0.0) is a and it.at(a, b, 0, 1.0) is b
    mid = it.at(a, b, 0, 0.5)
    assert mid.shape == a.shape and 0 < mid.mean() < 255 and mid[30, 20:40].mean() > 20


def test_sfx_every_kind_and_wav_roundtrip(tmp_path):
    items = [(k, 0.3 + 0.2 * i, 1.0, 0.5 * (-1) ** i) for i, k in enumerate(("impact", "strike", "slowmo", "kick", "hat"))]
    mix = sfx.mix_events(2.0, items)
    assert mix.shape[1] == 2 and np.abs(mix).max() > 0.05
    sfx.write_wav(str(tmp_path / "x.wav"), mix)
    from motiontrack.render import _read_wav

    back = _read_wav(tmp_path / "x.wav", len(mix))
    assert np.abs(back - mix).max() < 1e-3
    assert len(sfx.riser(0.3)) == int(sfx.SR * 0.3) and sfx.hat().max() > 0 and sfx.kick().max() > 0


def test_beats_edge_cases():
    assert beats._tempo(np.zeros(10, np.float32), 43.0) == (0.0, [])
    short = beats.analyze_audio(np.zeros(100, np.float32))
    assert short.bpm == 0.0 and short.kicks == []
    f = beats.analyze_audio(np.random.default_rng(0).standard_normal(beats.SR * 6).astype(np.float32) * 0.1)
    assert f.at(f.bass, 1.0) >= 0 and "bpm" in f.to_json()
    assert len(beats.onset_envelope(np.random.default_rng(1).standard_normal(beats.SR * 3).astype(np.float32), 24.0)) == 72


def test_signals_helpers():
    from motiontrack.signals import Signals, intensity_curve

    sig = Signals(24.0, 48, np.linspace(0, 1, 48).astype(np.float32), {}, {})
    curve = intensity_curve(sig, 4.0)
    assert len(curve) == 8 and curve[0] == 0 and curve[-1] == 1
    assert sig.to_json()["events"] == [] and analyze(TrackSet(24.0, 640, 352, 10)).bpm == 0.0


def test_track_helpers_roundtrip_and_pose_wrapper(monkeypatch):
    from motiontrack import track

    t = _person(1, 10, 100)
    assert t.last == 9 and t.at(3) and not t.at(30) and t.scale() > 0
    assert np.allclose(t.kp_f(2.5), (t.kp[2] + t.kp[3]) / 2) and t.at_f(9.2) and not t.at_f(40)
    kp, valid = track._interp_gaps(np.array([[0.0], [0.0], [3.0]]), np.array([True, False, True]), 2)
    assert valid.all() and kp[1, 0] == pytest.approx(1.5)

    class FakeBody:
        def __init__(self, **kw):
            self.det_model = lambda frame: np.array([[10, 10, 50, 100, 0.9]], np.float32)
            self.pose_model = lambda frame, bboxes: (np.zeros((1, 17, 2), np.float32), np.ones((1, 17), np.float32))

    import rtmlib

    monkeypatch.setattr(rtmlib, "Body", FakeBody)
    boxes, kps, scs, conf = track.Pose()(np.zeros((120, 160, 3), np.uint8))
    assert boxes.shape == (1, 4) and kps.shape == (1, 17, 2) and scs.shape == (1, 17)
    FakeBody.__init__ = lambda self, **kw: (setattr(self, "det_model", lambda f: None), None)[1]
    assert track.Pose()(np.zeros((8, 8, 3), np.uint8))[0].shape == (0, 4)


def test_render_audio_paths(tmp_path):
    from motiontrack import render as R

    video, tr, song = _video(tmp_path), _tracks(tmp_path), _music(tmp_path)
    m = R.render(str(video), str(tmp_path / "a.mp4"), "anime-fight", tracks=str(tr), music=str(song), max_side=480, max_seconds=3, log=lambda *_: None)
    assert m["audio"] and m["seconds"] > 0
    silent = R.render(str(video), str(tmp_path / "s.mp4"), "neon-trails", tracks=str(tr), max_side=480, max_seconds=2, slowmo=False, with_sfx=False, log=lambda *_: None)
    assert silent["audio"] is True  # source audio is kept
    assert R.has_audio(str(video)) and not R.has_audio(str(tr))


def test_reframe_geometry_and_camera_follow():
    from motiontrack import reframe as rf

    assert rf.crop_size(1280, 704, "9:16") == (396, 704)
    assert rf.crop_size(1280, 704, "1:1") == (704, 704)
    assert rf.crop_size(704, 1280, "16:9") == (704, 396)
    ow, oh = rf.output_size(396, 704)
    assert (ow, oh) == (720, 1280) or max(ow, oh) == 1280
    assert max(rf.output_size(1280, 704)) == 1280 and rf.output_size(100, 60)[0] <= 200
    ts = TrackSet(24.0, 1280, 704, 96)
    left, right = _person(1, 96, 300), _person(2, 96, 1000)
    right.box[48:] = 0
    right.valid[48:] = False
    ts.tracks = [left, right]
    sig = analyze(ts)
    path = rf.camera_path(ts, sig, 96, 396, 704)
    assert path.shape == (96, 2) and path[:, 0].min() >= 198 and path[:, 0].max() <= 1280 - 198
    assert path[0, 0] < path[40, 0] or path[60, 0] < 700
    empty = rf.camera_path(TrackSet(24.0, 1280, 704, 10), sig, 10, 396, 704)
    assert np.allclose(empty[0], [640, 352])
    img = np.arange(704 * 1280, dtype=np.float32).reshape(704, 1280)
    assert rf.crop_frame(img, np.array([10.0, 10.0]), 396, 704).shape == (704, 396)


def test_render_reframes_to_vertical(tmp_path):
    from motiontrack import render as R

    video, tr = _video(tmp_path, size="1280x704"), _tracks(tmp_path)
    ts = TrackSet.load(tr)
    ts.width, ts.height = 640, 352
    m = R.render(str(video), str(tmp_path / "v.mp4"), "neon-trails", tracks=str(tr), aspect="9:16", max_side=640, max_seconds=2, slowmo=False, log=lambda *_: None)
    assert m["width"] < m["height"] and m["height"] == 640 or m["height"] <= 1280
    size = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", m["output"]], capture_output=True, text=True).stdout.strip()
    assert size == f"{m['width']},{m['height']}"


def test_fight_stats_counts_hits():
    from motiontrack.signals import fight_stats

    ts = _set()
    ts.tracks[0].kp[40:, 16, 0] = ts.tracks[1].kp[40:, 11, 0]
    sig = analyze(ts)
    st = fight_stats(ts, sig)
    assert st["total_strikes"] == len(sig.events) and st["fighters"]["1"]["top_speed"] > 0
    assert st["fighters"]["2"]["hits_taken"] == st["fighters"]["1"]["impacts"] and st["most_active"] == "1"
    assert 0 <= st["peak_intensity_t"] <= 4.0
