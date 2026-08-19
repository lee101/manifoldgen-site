import argparse
import tempfile
from pathlib import Path
import unittest

import torch

import matting


class MattingTests(unittest.TestCase):
    def test_job_key_ignores_location_but_not_content_or_parameters(self):
        base = {"schema": 1, "input": "/a", "input_sha256": "abc", "downsample_ratio": .25}
        moved = dict(base, input="/b")
        changed = dict(base, downsample_ratio=.5)
        self.assertEqual(matting.job_key(base), matting.job_key(moved))
        self.assertNotEqual(matting.job_key(base), matting.job_key(changed))

    def test_recolor_none_is_exact(self):
        source = torch.rand(1, 3, 16, 20)
        alpha = torch.rand(1, 1, 16, 20)
        self.assertIs(matting.low_frequency_recolor(source, alpha, "none", .7), source)

    def test_recolor_does_not_touch_background(self):
        source = torch.rand(1, 3, 16, 20)
        alpha = torch.zeros(1, 1, 16, 20)
        actual = matting.low_frequency_recolor(source, alpha, "rose-gold", .7)
        self.assertTrue(torch.equal(actual, source))

    def test_transport_changes_job_identity(self):
        base = {"schema": 1, "input_sha256": "abc", "transport_preference": "portable"}
        strict = dict(base, transport_preference="zero-copy")
        self.assertNotEqual(matting.job_key(base), matting.job_key(strict))


if __name__ == "__main__":
    unittest.main()
