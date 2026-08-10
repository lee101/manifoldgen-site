from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest import mock


def load_generator():
    path = Path(__file__).resolve().parents[2] / "scripts" / "gen_gallery_local.py"
    spec = importlib.util.spec_from_file_location("manifold_h3_gallery_generator", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


class H3GalleryContainerLifecycleTests(unittest.TestCase):
    def test_new_worker_uses_persistent_restart_policy_and_stable_startup_quant(self):
        module = load_generator()
        commands: list[list[str]] = []
        with tempfile.TemporaryDirectory() as directory:
            module.WEIGHTS = Path(directory)
            with (
                mock.patch.object(module, "docker_running", return_value=False),
                mock.patch.object(module, "sync_patch"),
                mock.patch.object(module, "wait_healthy"),
                mock.patch.object(module.subprocess, "call", return_value=0),
                mock.patch.object(
                    module.subprocess,
                    "check_call",
                    side_effect=lambda command, **kwargs: commands.append(command),
                ),
            ):
                module.ensure_container()

        run = commands[-1]
        self.assertEqual(run[:3], ["docker", "run", "-d"])
        restart = run.index("--restart")
        self.assertEqual(run[restart + 1], "unless-stopped")
        quant = run.index("H3_QUANT=int8_convrot")
        self.assertEqual(run[quant - 1], "-e")


if __name__ == "__main__":
    unittest.main()
