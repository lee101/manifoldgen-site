import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from runtime import H3ControlRuntime


class RuntimeContractTests(unittest.TestCase):
    def test_dimensions_are_multiple_of_32(self):
        for tier in ("480p", "576p", "720p"):
            self.assertTrue(all(value % 32 == 0 for value in H3ControlRuntime.dimensions(tier)))

    def test_frame_snap_matches_h3_vae(self):
        self.assertEqual(H3ControlRuntime.snap_frames(120, 120), 107)
        self.assertEqual(H3ControlRuntime.snap_frames(243, 243), 243)
        self.assertEqual(H3ControlRuntime.snap_frames(3, 72), 5)


if __name__ == "__main__":
    unittest.main()
