from __future__ import annotations

import base64
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
        network = run.index("--network")
        self.assertEqual(run[network + 1], "host")
        self.assertNotIn("-p", run)
        restart = run.index("--restart")
        self.assertEqual(run[restart + 1], "unless-stopped")
        self.assertIn(f"PORT={module.PORT}", run)
        quant = run.index("H3_QUANT=int8_convrot")
        self.assertEqual(run[quant - 1], "-e")
        self.assertNotIn("H3_DISABLE_DYNAMIC_VRAM=1", run)
        self.assertIn("H3_VRAM_BROKER_URL=http://127.0.0.1:8791", run)
        self.assertIn("H3_VRAM_BROKER_REQUIRED=1", run)
        self.assertIn("H3_VRAM_LEASE_MIN_MB=12288", run)
        self.assertIn("H3_VRAM_LEASE_WAIT_SECONDS=900", run)
        self.assertIn(
            f"{module.PATCH / 'h3_benchmark.py'}:/src/h3_benchmark.py:ro",
            run,
        )

    def test_generation_explicitly_requests_stable_quant(self):
        module = load_generator()
        captured = {}

        def respond(method, url, payload, timeout):
            captured.update(payload)
            output = "data:video/webm;base64," + base64.b64encode(b"video").decode()
            return 200, {"status": "succeeded", "output": output}

        with mock.patch.object(module, "http_json", side_effect=respond):
            result = module.generate("test", size="preview", steps=8, duration=4, seed=7)
        try:
            self.assertEqual(captured["input"]["quant"], "int8_convrot")
            self.assertEqual(captured["input"]["output_codec"], "webm-av1")
        finally:
            result.unlink(missing_ok=True)
            result.parent.rmdir()


if __name__ == "__main__":
    unittest.main()
