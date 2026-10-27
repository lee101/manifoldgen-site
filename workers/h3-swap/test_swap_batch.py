import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_swap_worker import stub_handler_deps


def test_gpu_profile_selection(monkeypatch):
    import gpu_profile as gp
    monkeypatch.delenv("SWAP_PROFILE", raising=False)
    cases = {
        "NVIDIA H100 80GB HBM3|9.0|79.6": "hopper-80",
        "NVIDIA H200|9.0|140.4": "hopper-141",
        "NVIDIA B200|10.0|179.1": "blackwell-dc-180",
        "NVIDIA B300 SXM6 AC|10.3|281.0": "blackwell-dc-180",
        "NVIDIA RTX PRO 6000 Blackwell Server Edition|12.0|95.6": "blackwell-ws-96",
        "NVIDIA RTX PRO 5000 Blackwell|12.0|48.0": "blackwell-ws-48",
        "NVIDIA L40S|8.9|45.0": "ada-48",
        "NVIDIA A100 80GB PCIe|8.0|80.0": "ampere-80",
        "NVIDIA A40|8.6|45.0": "ampere-48",
        "weird|5.0|8.0": "safe",
    }
    for forced, expected in cases.items():
        monkeypatch.setenv("SWAP_GPU_OVERRIDE", forced)
        assert gp.select().name == expected, forced
    monkeypatch.setenv("SWAP_GPU_OVERRIDE", "NVIDIA A40|8.6|45.0")
    assert gp.clamp_megapixels(1.5, gp.select()) == 0.98
    assert gp.clamp_megapixels(0.4, gp.select()) == 0.4
    monkeypatch.setenv("SWAP_MAX_MP", "0.66")
    assert gp.clamp_megapixels(0.98, gp.select()) == 0.66 and gp.select().name == "ampere-48+env"
    monkeypatch.delenv("SWAP_MAX_MP")
    monkeypatch.setenv("SWAP_PROFILE", "safe")
    assert gp.select().name == "safe"


def test_comfy_flags_follow_profile(monkeypatch, tmp_path):
    import gpu_profile as gp
    (tmp_path / "comfy").mkdir()
    (tmp_path / "comfy" / "cli_args.py").write_text("--use-ck-attention --use-pytorch-cross-attention --highvram --disable-dynamic-vram")
    monkeypatch.setattr(gp, "COMFY_DIR", tmp_path)
    monkeypatch.setenv("SWAP_VRAM", "high")
    flags = gp.comfy_flags(gp.with_env(gp.PROFILES["hopper-141"]))
    monkeypatch.delenv("SWAP_VRAM")
    assert "--highvram" in flags and "--use-ck-attention" in flags and flags[:3] == ["--disable-metadata", "--reserve-vram", "1.5"]
    assert "--highvram" not in gp.comfy_flags(gp.SAFE)
    assert gp.attention_flag("sage") is None


def test_graph_profile_options():
    import swap_graph as g
    graph = g.build_swap_graph(prompt="p", width=832, height=480, frames=124, steps=20, seed=1, video_name="v.mp4", image_names=["a.png"],
                               vae_tiled=True, compile_backend="inductor", model_name="x.safetensors", easycache=(0.12, 0.15, 0.9))
    assert graph["11"]["class_type"] == "VAEDecodeTiled" and graph["1"]["inputs"]["unet_name"] == "x.safetensors"
    assert graph["28"]["class_type"] == "TorchCompileModel" and graph["25"]["inputs"]["model"] == ["28", 0]
    plain = g.build_swap_graph(prompt="p", width=832, height=480, frames=124, steps=20, seed=1, video_name="v.mp4", image_names=["a.png"])
    assert plain["11"]["class_type"] == "VAEDecode" and "28" not in plain


def fake_runtime(outputs, fail=None):
    class Runtime:
        def generate_resilient(self, **kwargs):
            if fail and kwargs["seed"] in fail:
                raise RuntimeError("boom")
            return outputs.pop(0), {"gpu": "fake", "profile": "safe"}
    return Runtime()


def batch_handler(monkeypatch, tmp_path, runtime):
    handler = stub_handler_deps(monkeypatch, lambda url: tmp_path / "img.png")

    class Mod:
        def prompt_gate(self, prompt):
            return None

        def classify(self, prompt, output):
            return {"status": "ok"}

    uploads = []
    monkeypatch.setattr(handler, "start_preload", lambda: None)
    monkeypatch.setattr(handler, "runtime", lambda: runtime)
    monkeypatch.setattr(handler, "moderation", lambda: Mod())
    monkeypatch.setattr(handler, "download_video", lambda url: tmp_path / "src.mp4")
    monkeypatch.setattr(handler, "_upload_output", lambda path, up, pub: uploads.append(pub) or {"url": pub, "bytes": 1})
    monkeypatch.setattr(handler, "release_media", lambda path: None)
    (tmp_path / "src.mp4").write_bytes(b"x")
    return handler, uploads


def clip(name, seed):
    return {"id": name, "video_url": f"https://x/{name}.mp4", "seed": seed, "_output_upload_url": "u" + name, "_output_public_url": "p" + name}


def test_batch_streams_each_clip_and_isolates_failures(monkeypatch, tmp_path):
    handler, uploads = batch_handler(monkeypatch, tmp_path, fake_runtime([tmp_path / "a", tmp_path / "b"], fail={2}))
    event = {"input": {"prompt": "swap", "image_urls": ["https://x/a.png"], "steps": 20, "clips": [clip("c0", 1), clip("c1", 2), clip("c2", 3)]}}
    by_clip = {r["clip"]: r for r in handler.handler(event)}
    assert set(by_clip) == {"c0", "c1", "c2"}
    assert "error" in by_clip["c1"] and by_clip["c0"]["outputs"][0]["url"] == "pc0" and by_clip["c2"]["outputs"][0]["url"] == "pc2"
    assert sorted(uploads) == ["pc0", "pc2"]


def test_batch_cuts_clips_from_one_shared_video(monkeypatch, tmp_path):
    handler, uploads = batch_handler(monkeypatch, tmp_path, fake_runtime([tmp_path / "a", tmp_path / "b"]))
    cuts, downloads = [], []
    monkeypatch.setattr(handler, "download_video", lambda url: downloads.append(url) or tmp_path / "src.mp4")
    monkeypatch.setattr(handler, "cut_clip", lambda source, start, length: cuts.append((start, length)) or tmp_path / "cut.mp4")
    shared = {"id": "s0", "start": 0, "length": 4.8, "seed": 1, "_output_upload_url": "u", "_output_public_url": "ps0"}
    other = {**shared, "id": "s1", "start": 4.55, "length": 4.8, "seed": 2, "_output_public_url": "ps1"}
    list(handler.handler({"input": {"prompt": "s", "image_urls": ["https://x/a.png"], "video_url": "https://x/full.mp4", "clips": [shared, other]}}))
    assert cuts == [(0, 4.8), (4.55, 4.8)] and downloads == ["https://x/full.mp4"]


def test_single_clip_input_still_yields_one_result(monkeypatch, tmp_path):
    handler, uploads = batch_handler(monkeypatch, tmp_path, fake_runtime([tmp_path / "a"]))
    monkeypatch.setattr(handler, "media_artifact", lambda path: {"data": "eA==", "filename": "a.mp4"})
    results = list(handler.handler({"input": {"prompt": "swap", "image_urls": ["https://x/a.png"], "video_url": "https://x/v.mp4", "seed": 5}}))
    assert len(results) == 1 and results[0]["outputs"][0]["data"] == "eA==" and results[0]["metrics"]["gpu"] == "fake"


def test_batch_requires_upload_urls_and_limits_size(monkeypatch, tmp_path):
    handler, _ = batch_handler(monkeypatch, tmp_path, fake_runtime([]))
    with pytest.raises(ValueError):
        list(handler.handler({"input": {"prompt": "s", "image_urls": ["https://x/a.png"], "clips": [{"video_url": "https://x/0.mp4"}]}}))
    with pytest.raises(ValueError):
        list(handler.handler({"input": {"prompt": "s", "image_urls": ["https://x/a.png"], "clips": []}}))


def test_resilient_demotes_once_on_first_job_failure(monkeypatch, tmp_path):
    import swap_runtime
    import gpu_profile as gp
    monkeypatch.setattr(swap_runtime, "OUT_DIR", tmp_path / "o")
    monkeypatch.setattr(swap_runtime, "IN_DIR", tmp_path / "i")
    monkeypatch.setattr(swap_runtime.SwapRuntime, "spawn", lambda self: None)
    monkeypatch.setattr(swap_runtime.SwapRuntime, "wait_ready", lambda self: None)
    monkeypatch.setattr(swap_runtime.weights, "ensure_weights", lambda: None)
    monkeypatch.setattr(swap_runtime, "StageTimer", lambda port, cid: object())
    runtime = swap_runtime.SwapRuntime(profile=gp.PROFILES["hopper-141"])
    restarts, calls = [], []
    monkeypatch.setattr(runtime, "close", lambda: None)
    monkeypatch.setattr(runtime, "start", lambda: restarts.append(runtime.profile.name))

    def generate(**kwargs):
        calls.append(runtime.profile.name)
        if runtime.profile.name != "safe":
            raise RuntimeError("fast path broke")
        return tmp_path / "o.mp4", {}

    monkeypatch.setattr(runtime, "generate", generate)
    path, metrics = runtime.generate_resilient()
    assert calls == ["hopper-141", "safe"] and restarts == ["safe"] and "fast path broke" in metrics["fast_path_error"]
    monkeypatch.setattr(runtime, "generate", lambda **k: (_ for _ in ()).throw(RuntimeError("later failure")))
    with pytest.raises(RuntimeError):
        runtime.generate_resilient()
    assert restarts == ["safe"]


def test_weight_plan_defers_extra_turbo_loras_and_adds_quant(monkeypatch):
    import swap_weights as w
    monkeypatch.setattr(w, "fetch_json", lambda url: {p: {"size": 1, "sha256": "x"} for p in w.BASE_FILES})
    core = [e["path"] for e in w.plan()]
    assert len(core) == 6 and not any("8step" in p or "fl2v" in p for p in core)
    name = next(iter(w.LIGHTX_FILES))
    assert f"loras/{name}" in [e["path"] for e in w.plan("int8_convrot", (name,))]
    assert any("fp8_scaled" in e["path"] for e in w.plan("fp8_scaled"))
    assert not any("fp8_scaled" in p for p in core)


def test_first_clip_is_streamed_while_the_second_still_generates(monkeypatch, tmp_path):
    import threading
    gate = threading.Event()

    class Runtime:
        def generate_resilient(self, **kwargs):
            if kwargs["seed"] == 2:
                assert gate.wait(10)
            return tmp_path / f"o{kwargs['seed']}", {"gpu": "fake"}

    handler, uploads = batch_handler(monkeypatch, tmp_path, Runtime())
    stream = handler.handler({"input": {"prompt": "s", "image_urls": ["https://x/a.png"], "clips": [clip("c0", 1), clip("c1", 2)]}})
    first = next(stream)
    assert first["clip"] == "c0" and uploads == ["pc0"]
    gate.set()
    assert next(stream)["clip"] == "c1"
    assert list(stream) == []


def test_boot_events_stream_while_the_runtime_is_loading(monkeypatch, tmp_path):
    import threading
    gate = threading.Event()

    class Runtime:
        def generate_resilient(self, **kwargs):
            assert gate.wait(10)
            return tmp_path / "o", {"gpu": "fake"}

    handler, uploads = batch_handler(monkeypatch, tmp_path, Runtime())
    monkeypatch.setattr(handler, "BOOT_EVENT_SECONDS", 0.05)
    monkeypatch.setattr(handler, "_ready_at", None)
    stream = handler.handler({"input": {"prompt": "s", "image_urls": ["https://x/a.png"], "clips": [clip("c0", 1)]}})
    event = next(stream)
    assert event["event"] == "boot" and "weights_gb" in event and "weights_total_gb" in event
    gate.set()
    rest = [item for item in stream if "clip" in item]
    assert [item["clip"] for item in rest] == ["c0"]
