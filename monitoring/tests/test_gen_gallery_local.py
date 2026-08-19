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
    def test_patch_bundle_contains_new_runtime_dependencies(self):
        module = load_generator()
        self.assertIn("h3_model_profile.py", module.PATCH_MODULES)
        self.assertIn("h3_moderation.py", module.PATCH_MODULES)

    def test_new_worker_uses_persistent_restart_policy_and_stable_startup_quant(self):
        module = load_generator()
        commands: list[list[str]] = []
        with tempfile.TemporaryDirectory() as directory:
            module.WEIGHTS = Path(directory)
            with (
                mock.patch.object(module, "docker_running", return_value=False),
                mock.patch.object(module, "port_available", return_value=True),
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
        self.assertIn(f"H3_COMFY_PORT={module.COMFY_PORT}", run)
        quant = run.index("H3_QUANT=int8_convrot")
        self.assertEqual(run[quant - 1], "-e")
        self.assertNotIn("H3_DISABLE_DYNAMIC_VRAM=1", run)
        self.assertIn("H3_VRAM_BROKER_URL=http://127.0.0.1:8791", run)
        self.assertIn("H3_VRAM_BROKER_REQUIRED=1", run)
        self.assertIn("H3_VRAM_LEASE_MIN_MB=12288", run)
        self.assertIn("H3_VRAM_LEASE_WAIT_SECONDS=900", run)
        self.assertIn("H3_GPU_PEER_URL=http://127.0.0.1:8100", run)
        self.assertIn("H3_GPU_PEER_REQUIRED=1", run)
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

    def test_generation_exposes_cancellation_and_capacity_as_deferred_conditions(self):
        module = load_generator()
        with mock.patch.object(
            module,
            "http_json",
            return_value=(200, {"status": "canceled", "id": "pred-test"}),
        ):
            with self.assertRaises(module.PredictionCanceled):
                module.generate("test", size="preview", steps=20, duration=5, seed=7)
        with mock.patch.object(
            module,
            "http_json",
            return_value=(
                200,
                {"status": "failed", "error": "H3 GPU capacity unavailable"},
            ),
        ):
            with self.assertRaises(module.PredictionCapacityUnavailable):
                module.generate("test", size="preview", steps=20, duration=5, seed=7)

    def test_trajectory_worker_mounts_private_capture_root(self):
        module = load_generator()
        commands: list[list[str]] = []
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            module.WEIGHTS = root / "weights"
            module.WEIGHTS.mkdir()
            module.TRAJECTORY_ROOT = root / "trajectories"
            module.TRAJECTORY_CAPTURE = "full"
            module.TRAJECTORY_DATASET = "popular-v1"
            with (
                mock.patch.object(module, "docker_running", return_value=False),
                mock.patch.object(module, "port_available", return_value=True),
                mock.patch.object(module, "sync_patch"),
                mock.patch.object(module, "wait_healthy"),
                mock.patch.object(module.subprocess, "call", return_value=0),
                mock.patch.object(module.subprocess, "check_call", side_effect=lambda command, **kwargs: commands.append(command)),
            ):
                module.ensure_container()
        run = commands[-1]
        self.assertIn(f"{module.TRAJECTORY_ROOT}:/trajectories", run)
        self.assertIn("H3_TRAJECTORY_ENABLED=1", run)
        self.assertIn("H3_TRAJECTORY_CAPTURE=full", run)
        self.assertIn("H3_TRAJECTORY_DATASET=popular-v1", run)
        self.assertIn(f"{module.PATCH / 'h3_trajectory.py'}:/src/h3_trajectory.py:ro", run)


if __name__ == "__main__":
    unittest.main()
