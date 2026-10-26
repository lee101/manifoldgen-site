import sys
import threading
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))


def load_handler():
    sys.modules["runpod"] = types.ModuleType("runpod")
    pre = types.ModuleType("preprocess")
    pre.preprocess_video = lambda *a, **k: None
    sys.modules["preprocess"] = pre
    sys.modules.pop("handler", None)
    import handler
    return handler


class PreloadTests(unittest.TestCase):
    def test_single_runtime_and_overlap_with_download(self):
        handler = load_handler()
        started, release, built = threading.Event(), threading.Event(), []

        class Fake:
            def __init__(self):
                built.append(1)
                started.set()
                release.wait(5)

        handler.H3ControlRuntime = Fake
        handler.os.environ["MINIMAX_H3_LICENSE_ACCEPTED"] = "1"
        handler._start_preload()
        handler._start_preload()
        self.assertTrue(started.wait(5))
        results = []
        thread = threading.Thread(target=lambda: results.append(handler._get_runtime()))
        thread.start()
        release.set()
        thread.join(5)
        handler._preload.join(5)
        self.assertEqual(built, [1])
        self.assertIsInstance(results[0], Fake)

    def test_preload_failure_is_retried_by_job(self):
        handler = load_handler()
        calls = []

        class Flaky:
            def __init__(self):
                calls.append(1)
                if len(calls) == 1:
                    raise RuntimeError("boom")

        handler.H3ControlRuntime = Flaky
        handler.os.environ["MINIMAX_H3_LICENSE_ACCEPTED"] = "1"
        handler._start_preload()
        handler._preload.join(5)
        self.assertIsNone(handler._runtime)
        self.assertIsInstance(handler._get_runtime(), Flaky)


if __name__ == "__main__":
    unittest.main()
