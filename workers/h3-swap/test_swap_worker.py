import sys
import threading
import types
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))


def stub_handler_deps(monkeypatch, download_image):
    for name, attrs in {
        "runpod": {},
        "h3_moderation": {"Moderation": object},
        "h3_serverless": {"media_artifact": None, "release_media": None},
        "rp_handler": {"_download_image": download_image, "_public_https": lambda url: None, "_upload_output": None},
    }.items():
        module = types.ModuleType(name)
        module.__dict__.update(attrs)
        monkeypatch.setitem(sys.modules, name, module)
    sys.modules.pop("swap_handler", None)
    import swap_handler
    return swap_handler


def test_fetch_inputs_concurrent_and_ordered(monkeypatch, tmp_path):
    barrier = threading.Barrier(3, timeout=5)

    def image(url):
        barrier.wait()
        return tmp_path / url

    handler = stub_handler_deps(monkeypatch, image)

    def video(url):
        barrier.wait()
        return tmp_path / url

    monkeypatch.setattr(handler, "download_video", video)
    source, images = handler.fetch_inputs("v.mp4", ["a.png", "b.png"])
    assert source == tmp_path / "v.mp4" and images == [tmp_path / "a.png", tmp_path / "b.png"]


def test_fetch_inputs_cleans_up_on_failure(monkeypatch, tmp_path):
    good = tmp_path / "v.mp4"
    good.write_bytes(b"x")

    def image(url):
        raise ValueError("bad image")

    handler = stub_handler_deps(monkeypatch, image)
    monkeypatch.setattr(handler, "download_video", lambda url: good)
    with pytest.raises(ValueError):
        handler.fetch_inputs("v.mp4", ["a.png"])
    assert not good.exists()


def test_runtime_spawns_before_weights(monkeypatch, tmp_path):
    import swap_runtime
    events = []
    monkeypatch.setattr(swap_runtime, "OUT_DIR", tmp_path / "o")
    monkeypatch.setattr(swap_runtime, "IN_DIR", tmp_path / "i")
    monkeypatch.setattr(swap_runtime.SwapRuntime, "spawn", lambda self: events.append("spawn"))
    monkeypatch.setattr(swap_runtime.SwapRuntime, "wait_ready", lambda self: events.append("ready"))
    monkeypatch.setattr(swap_runtime.weights, "ensure_weights", lambda: events.append("weights"))
    swap_runtime.SwapRuntime()
    assert events == ["spawn", "weights", "ready"]


def test_runtime_closes_comfy_when_weights_fail(monkeypatch, tmp_path):
    import swap_runtime
    closed = []
    monkeypatch.setattr(swap_runtime, "OUT_DIR", tmp_path / "o")
    monkeypatch.setattr(swap_runtime, "IN_DIR", tmp_path / "i")
    monkeypatch.setattr(swap_runtime.SwapRuntime, "spawn", lambda self: None)
    monkeypatch.setattr(swap_runtime.SwapRuntime, "close", lambda self: closed.append(1))
    monkeypatch.setattr(swap_runtime.weights, "ensure_weights", lambda: (_ for _ in ()).throw(RuntimeError("x")))
    with pytest.raises(RuntimeError):
        swap_runtime.SwapRuntime()
    assert closed == [1]


def test_runtime_preload_builds_once(monkeypatch):
    handler = stub_handler_deps(monkeypatch, lambda url: None)
    built, release = [], threading.Event()

    class Fake:
        def __init__(self):
            built.append(1)
            release.wait(5)

    monkeypatch.setattr(handler, "SwapRuntime", Fake)
    monkeypatch.setattr(handler, "_runtime", None)
    monkeypatch.setattr(handler, "_preload", None)
    handler.start_preload()
    handler.start_preload()
    out = []
    thread = threading.Thread(target=lambda: out.append(handler.runtime()))
    thread.start()
    release.set()
    thread.join(5)
    handler._preload.join(5)
    assert built == [1] and isinstance(out[0], Fake)
