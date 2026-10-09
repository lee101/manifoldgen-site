import importlib.util
import sys
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "generate_gallery_art.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("manifold_gallery_generator", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_gallery_upload_ignores_an_unrelated_ambient_r2_bucket(monkeypatch):
    generator = load_generator()
    monkeypatch.setenv("R2_ACCOUNT_ID", "account")
    monkeypatch.setenv("R2_BUCKET", "unrelated-site-bucket")
    monkeypatch.setenv("R2_PATH_PREFIX", "unrelated-prefix")
    monkeypatch.setenv("CLOUDFLARE_R2_ACCESS_KEY_ID", "access")
    monkeypatch.setenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "secret")
    monkeypatch.delenv("MANIFOLDGEN_R2_BUCKET", raising=False)
    monkeypatch.delenv("MANIFOLDGEN_R2_PATH_PREFIX", raising=False)

    config = generator.gallery_r2_config()

    assert config.bucket == "manifoldgenstatic"
    assert config.prefix == "gallery"


def test_image_worker_secret_uses_the_repository_environment_name(monkeypatch):
    generator = load_generator()
    monkeypatch.delenv("OMNISERVE_NATIVE_SECRET", raising=False)
    monkeypatch.delenv("OMNISERVE_SECRET", raising=False)
    monkeypatch.delenv("IMAGE_API_SECRET", raising=False)
    monkeypatch.setenv("OMNISERVE_IMAGE_WORKER_SECRET", "repository-secret")

    assert generator.image_worker_secret() == "repository-secret"


def test_read_prompts_treats_null_dimensions_as_unset(tmp_path):
    shard = tmp_path / 'shard.jsonl'
    shard.write_text(
        '{"prompt": "a lighthouse on a cliff at dawn", "seed": null, "width": null, "height": null}\n'
        '{"prompt": "a fox curled up in fresh snow", "width": 768, "height": 1344}\n'
    )
    prompts = load_generator().read_prompts(shard)
    assert [(p.width, p.height) for p in prompts] == [(None, None), (768, 1344)]


def test_read_prompts_still_rejects_unaligned_dimensions(tmp_path):
    shard = tmp_path / 'shard.jsonl'
    shard.write_text('{"prompt": "a lighthouse on a cliff at dawn", "width": 1000, "height": 1000}\n')
    generator = load_generator()
    try:
        generator.read_prompts(shard)
    except ValueError:
        return
    raise AssertionError('unaligned dimensions were accepted')
