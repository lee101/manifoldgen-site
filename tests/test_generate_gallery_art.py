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


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=()):
        self.conn.events.append(("sql", sql.split()[0], params[:2] if params else ()))
        if "pg_try_advisory_lock" in sql or "EXISTS" in sql:
            self.rows = [("pg_try_advisory_lock" in sql,)]
        elif sql.startswith("SELECT prompt"):
            self.rows = []
        elif "INSERT INTO generated_images" in sql:
            if self.conn.fail_insert:
                raise self.conn.psycopg2.Error("insert failed")
            self.conn.inserted.append(params)
        else:
            self.rows = [(True,)]

    def fetchone(self):
        return self.rows[0]

    def __iter__(self):
        return iter(self.rows)


class FakeConn:
    def __init__(self, events, psycopg2_module, fail_insert=False):
        self.events = events
        self.inserted = []
        self.fail_insert = fail_insert
        self.psycopg2 = psycopg2_module
        self.autocommit = False

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        pass

    def rollback(self):
        self.events.append(("rollback",))

    def close(self):
        pass


class FakeR2:
    def __init__(self, events):
        self.events = events
        self.keys = []
        self.deleted = []

    def upload_file(self, path, bucket, key, ExtraArgs=None):
        self.events.append(("upload", key))
        self.keys.append(key)

    def head_object(self, Bucket, Key):
        return {}

    def delete_object(self, Bucket, Key):
        self.deleted.append(Key)


def png_bytes(width, height):
    import io
    from PIL import Image

    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (90, 120, 200)).save(buffer, "PNG")
    return buffer.getvalue()


def test_save_thumbnail_keeps_aspect(tmp_path):
    from PIL import Image

    generator = load_generator()
    destination = tmp_path / "t.webp"
    generator.save_thumbnail(Image.new("RGB", (1344, 768)), destination, 512, 78)
    assert Image.open(destination).size == (512, 293)


def test_moderation_keeps_classifier_loaded_by_default(monkeypatch, tmp_path):
    generator = load_generator()
    seen = {}

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return {"nsfw_score": 0.01}

    def post(url, params, files, timeout):
        seen.update(params)
        return Response()

    monkeypatch.setattr(generator.requests, "post", post)
    monkeypatch.setenv("OMNISERVE_NATIVE_SECRET", "s")
    path = tmp_path / "x.webp"
    path.write_bytes(b"x")
    assert generator.moderate_image("http://w:8100", path, 0.5, "OMNISERVE_NATIVE_SECRET", unload_after=False) == (False, 0.01)
    assert seen == {"secret": "s", "unload_after": "false"}


def test_publish_rolls_back_uploads_when_insert_fails(tmp_path):
    generator = load_generator()
    events = []
    conn = FakeConn(events, generator.psycopg2, fail_insert=True)
    r2 = FakeR2(events)
    original, thumb = tmp_path / "o.webp", tmp_path / "t.webp"
    original.write_bytes(b"o")
    thumb.write_bytes(b"t")
    item = generator.RenderedImage(1, "p", "id", "originals/a.webp", "thumbs/a.webp", original, thumb, 1024, 1024, 1, 7, False, {})
    try:
        generator.publish_image(item, conn, r2, "bucket", "gallery")
    except generator.psycopg2.Error:
        pass
    else:
        raise AssertionError("insert failure was swallowed")
    assert r2.deleted == ["gallery/originals/a.webp", "gallery/thumbs/a.webp"]
    assert not original.exists() and not thumb.exists()


def test_farm_overlaps_publish_with_next_generation(monkeypatch, tmp_path):
    import threading

    generator = load_generator()
    events = []
    conns = []
    r2 = FakeR2(events)
    publish_started = threading.Event()

    def connect(_url):
        conn = FakeConn(events, generator.psycopg2)
        conns.append(conn)
        return conn

    calls = {"n": 0}

    def generate(endpoint, model, prompt, width, height, seed, low_priority):
        calls["n"] += 1
        if calls["n"] == 2:
            assert publish_started.wait(5), "first publish did not start while second image was generating"
        events.append(("generate", prompt))
        return png_bytes(1024, 1024)

    original_upload = r2.upload_file

    def upload_file(path, bucket, key, ExtraArgs=None):
        publish_started.set()
        original_upload(path, bucket, key, ExtraArgs)

    r2.upload_file = upload_file
    prompts = tmp_path / "p.jsonl"
    prompts.write_text('{"prompt": "a cliffside observatory at dusk"}\n{"prompt": "a quiet harbor in morning fog"}\n')
    monkeypatch.setattr(generator.psycopg2, "connect", connect)
    monkeypatch.setattr(generator, "generate", generate)
    monkeypatch.setattr(generator, "gallery_r2_config", lambda: generator.GalleryR2Config("a", "e", "bucket", "gallery", "k", "s"))
    monkeypatch.setattr(generator, "r2_client", lambda config: r2)
    monkeypatch.setattr(generator, "moderate_image", lambda endpoint, path, threshold, env, unload_after=True: (False, 0.0))
    monkeypatch.setattr(generator, "ensure_free_space", lambda directory, minimum: None)
    monkeypatch.setattr(sys, "argv", ["x", "--prompts", str(prompts), "--database-url", "postgres://fake", "--images-dir", str(tmp_path / "img"),
                                      "--upload-r2", "--moderate-before-index", "--delay", "0"])
    generator.main()

    inserted = [row for conn in conns for row in conn.inserted]
    assert len(inserted) == 2
    for row in inserted:
        assert row[4].startswith("originals/") and row[5].startswith("thumbs/") and row[6] == row[4]
    assert sorted(k.split("/")[1] for k in r2.keys) == ["originals", "originals", "thumbs", "thumbs"]


def test_background_moderation_flags_before_any_upload(monkeypatch, tmp_path):
    generator = load_generator()
    events = []
    conn = FakeConn(events, generator.psycopg2)
    r2 = FakeR2(events)
    original, thumb = tmp_path / "o.webp", tmp_path / "t.webp"
    original.write_bytes(b"o")
    thumb.write_bytes(b"t")
    seen = []
    monkeypatch.setattr(generator, "moderate_image",
                        lambda endpoint, path, threshold, env, unload_after=True: (seen.append(path), (True, 0.97))[1])
    item = generator.RenderedImage(1, "p", "id", "originals/a.webp", "thumbs/a.webp", original, thumb, 1024, 1024, 1, 7, None, {})
    generator.moderate_and_publish(item, ("http://w:8100", 0.5, "S", False, False, 1), conn, r2, "bucket", "gallery")
    assert seen == [thumb]
    assert item.is_nsfw is True and "moderate" in item.timings
    assert r2.keys == []
