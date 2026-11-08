import numpy as np

from motiontrack.ptcache import Cache, CachedBackend, digest


class Fake:
    name = "sparse"
    calls = 0

    def tracks(self, frames, queries):
        Fake.calls += 1
        t = len(frames)
        return np.repeat(queries[None], t, 0) + 1.0, np.ones((t, len(queries)), bool)

    def consecutive_flow(self, frames, batch=4, iters=4):
        Fake.calls += 1
        return np.zeros((len(frames) - 1, 4, 4, 2), np.float16), np.ones((len(frames) - 1, 4, 4), np.float16)


def frames(seed=0, t=6):
    return np.random.default_rng(seed).integers(0, 255, (t, 8, 8, 3), dtype=np.uint8)


def test_hit_returns_same_arrays_without_calling_backend(tmp_path):
    Fake.calls = 0
    b = CachedBackend(Fake(), Cache(tmp_path), "t")
    f, q = frames(), np.array([[1, 2], [3, 4]], np.float32)
    p1, v1 = b.tracks(f, q)
    p2, v2 = b.tracks(f, q)
    assert Fake.calls == 1
    assert np.array_equal(p1, p2) and np.array_equal(v1, v2) and v2.dtype == bool


def test_key_changes_with_frames_queries_tag_and_kwargs(tmp_path):
    Fake.calls = 0
    b = CachedBackend(Fake(), Cache(tmp_path), "t")
    f, q = frames(), np.array([[1, 2]], np.float32)
    b.tracks(f, q)
    b.tracks(frames(1), q)
    b.tracks(f, q + 1)
    CachedBackend(Fake(), Cache(tmp_path), "other").tracks(f, q)
    assert Fake.calls == 4
    b.consecutive_flow(f)
    b.consecutive_flow(f, iters=2)
    b.consecutive_flow(f)
    assert Fake.calls == 6


def test_corrupt_entry_is_a_miss(tmp_path):
    Fake.calls = 0
    c = Cache(tmp_path)
    b = CachedBackend(Fake(), c, "t")
    f, q = frames(), np.array([[1, 2]], np.float32)
    b.tracks(f, q)
    for x in tmp_path.glob("*.npz"):
        x.write_bytes(b"junk")
    b.tracks(f, q)
    assert Fake.calls == 2


def test_eviction_keeps_cache_under_cap(tmp_path):
    c = Cache(tmp_path, cap=20_000)
    for i in range(30):
        c.put(f"k{i}", np.zeros(1000, np.float32))
    assert sum(x.stat().st_size for x in tmp_path.glob("*.npz")) <= 20_000
    assert c.get("k29") is not None


def test_digest_is_content_based():
    a = frames()
    assert digest("x", a) == digest("x", a.copy())
    b = a.copy()
    b[0, 0, 0, 0] ^= 1
    assert digest("x", a) != digest("x", b)


def test_disabled_backend_neither_reads_nor_writes(tmp_path):
    Fake.calls = 0
    b = CachedBackend(Fake(), Cache(tmp_path), "t")
    f, q = frames(), np.array([[1, 2]], np.float32)
    b.tracks(f, q)
    b.enabled = False
    b.tracks(f, q)
    b.tracks(f, q)
    assert Fake.calls == 3
    b.enabled = True
    b.tracks(f, q)
    assert Fake.calls == 3
