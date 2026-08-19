import importlib.util
from pathlib import Path

import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/deploy-h3-runpod.py"
SPEC = importlib.util.spec_from_file_location("deploy_h3_runpod", SCRIPT)
deploy = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(deploy)


def config():
    return {
        "image": "registry.example/h3:r17",
        "dockerStartCmd": ["python", "-u", "/src/rp_handler.py"],
        "env": {"H3_FACE_REFINE_ENABLED": "1", "H3_FACE_REFINE_REQUIRED": "0"},
        "workersMin": 0,
        "idleTimeout": 5,
        "executionTimeoutMs": 1000,
        "flashboot": True,
        "scalerType": "QUEUE_DELAY",
        "scalerValue": 4,
        "endpoints": [
            {
                "id": "normal",
                "templateId": "template",
                "name": "normal-h3",
                "workersMax": 2,
                "gpuTypeIds": ["NVIDIA L40S"],
                "env": {"H3_MODEL_VARIANT": "pinned-h3"},
                "unsetEnv": ["H3_FACE_REFINE_STEPS"],
            }
        ],
    }


def test_template_payload_preserves_variant_and_secrets_but_removes_canary_override():
    current = {
        "name": "normal-h3",
        "imageName": "old",
        "dockerStartCmd": ["old"],
        "env": {
            "SECRET": "preserved",
            "H3_MODEL_VARIANT": "normal-h3",
            "H3_FACE_REFINE_REQUIRED": "1",
            "H3_FACE_REFINE_STEPS": "8",
        },
    }

    payload = deploy.template_payload(current, config(), config()["endpoints"][0])

    assert payload["imageName"] == "registry.example/h3:r17"
    assert payload["dockerStartCmd"] == ["python", "-u", "/src/rp_handler.py"]
    assert payload["env"]["SECRET"] == "preserved"
    assert payload["env"]["H3_MODEL_VARIANT"] == "pinned-h3"
    assert payload["env"]["H3_FACE_REFINE_REQUIRED"] == "0"
    assert "H3_FACE_REFINE_STEPS" not in payload["env"]


def test_endpoint_payload_uses_deploy_contract():
    values = config()
    payload = deploy.endpoint_payload(values, values["endpoints"][0])

    assert payload == {
        "workersMin": 0,
        "workersMax": 2,
        "idleTimeout": 5,
        "executionTimeoutMs": 1000,
        "flashboot": True,
        "scalerType": "QUEUE_DELAY",
        "scalerValue": 4,
        "gpuTypeIds": ["NVIDIA L40S"],
    }


def test_validate_config_rejects_duplicate_endpoint_ids():
    values = config()
    values["endpoints"].append(dict(values["endpoints"][0]))

    with pytest.raises(ValueError, match="duplicate endpoint id"):
        deploy.validate_config(values)


def test_health_counters_ignore_completed_jobs():
    state = {
        "jobs": {"completed": 7, "inProgress": 1, "inQueue": 2},
        "workers": {"idle": 1, "running": 2, "unhealthy": 0},
    }

    assert deploy.active_job_count(state) == 3
    assert deploy.worker_count(state) == 3
