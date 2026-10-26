import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent))


@pytest.fixture
def enhance(monkeypatch):
    for name in ("grid", "lyrics", "mix", "quality", "vocal"):
        sys.modules.setdefault(name, type(sys)(name))
    sys.modules.pop("enhance", None)
    import enhance as module
    monkeypatch.setattr(module, "_WARM", None)
    return module


def test_warm_spawns_once_and_yue_joins_it(enhance, monkeypatch, tmp_path):
    spawned, waited = [], []

    class Proc:
        def wait(self, timeout=None):
            waited.append(timeout)

    monkeypatch.setattr(enhance, "YUE_PYTHON", sys.executable)
    monkeypatch.setattr(subprocess, "Popen", lambda cmd, **kw: spawned.append(cmd) or Proc())
    runs = []
    monkeypatch.setattr(subprocess, "run", lambda cmd, **kw: runs.append(cmd))
    enhance.warm_yue_cache()
    enhance.warm_yue_cache()
    assert len(spawned) == 1 and spawned[0][-1] == "--warm-hashes"
    enhance.yue("la la la", "style", tmp_path, [1], 100)
    assert waited == [300] and len(runs) == 1


def test_warm_skipped_without_interpreter(enhance, monkeypatch):
    monkeypatch.setattr(enhance, "YUE_PYTHON", "/nonexistent/python")
    monkeypatch.setattr(subprocess, "Popen", lambda *a, **k: pytest.fail("spawned"))
    enhance.warm_yue_cache()


def test_render_warm_flag_short_circuits(monkeypatch):
    import yue_render
    called = []
    monkeypatch.setattr(yue_render, "warm_hashes", lambda: called.append(1))
    monkeypatch.setattr(sys, "argv", ["yue_render.py", "--warm-hashes"])
    yue_render.main()
    assert called == [1]
