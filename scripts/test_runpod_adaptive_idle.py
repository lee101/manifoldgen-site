#!/usr/bin/env python3

import pathlib
import tempfile
import unittest
from unittest.mock import patch

import runpod_adaptive_idle as idle

ENV = {"tau": 15.0, "down_checks": 3, "bounds": {}}


def health(done, queue=0):
    return {"jobs": {"completed": done, "failed": 0, "inProgress": 0, "inQueue": queue}}


class AdaptiveIdleTest(unittest.TestCase):
    def test_tiers_are_monotonic_in_rate(self) -> None:
        values = [idle.tier(r) for r in (0, 0.2, 0.5, 1, 3, 10, 50)]
        self.assertEqual(values, sorted(values))
        self.assertEqual(values[0], 5)
        self.assertEqual(values[-1], 120)

    def test_busy_traffic_raises_immediately(self) -> None:
        prev = {"done": 0, "at": 0.0, "rate": 0.0}
        entry, change = idle.decide({"name": "x", "idleTimeout": 5}, health(600), prev, 600.0, ENV)
        self.assertGreater(entry["rate"], 10)
        self.assertEqual(change, 120)

    def test_quiet_traffic_lowers_only_after_consecutive_checks(self) -> None:
        endpoint = {"name": "x", "idleTimeout": 90}
        prev = {"done": 10, "at": 0.0, "rate": 0.0}
        changes = []
        for step in range(1, 4):
            prev, change = idle.decide(endpoint, health(10), prev, step * 120.0, ENV)
            changes.append(change)
        self.assertEqual(changes, [None, None, 5])

    def test_queue_sets_floor_and_bounds_clamp(self) -> None:
        env = dict(ENV, bounds={"cog-manifold-h3": [10, 20]})
        _, change = idle.decide({"name": "cog-manifold-h3-turbo", "idleTimeout": 5}, health(0, queue=2), {}, 1.0, env)
        self.assertEqual(change, 20)

    def test_counter_reset_keeps_previous_rate(self) -> None:
        self.assertEqual(idle.update_rate({"done": 50, "at": 0.0, "rate": 2.0}, 3, 120.0, 15.0), 2.0)

    def test_run_skips_zero_capacity_and_applies(self) -> None:
        endpoints = [{"id": "a", "name": "on", "workersMax": 1, "idleTimeout": 5}, {"id": "b", "name": "off", "workersMax": 0, "idleTimeout": 60}]
        with tempfile.TemporaryDirectory() as tmp, patch.object(idle, "request_json", return_value=endpoints), patch.object(idle, "queue_health", return_value=health(0, queue=1)) as qh, patch.object(idle, "patch_endpoint") as pe:
            report = idle.run("k", pathlib.Path(tmp) / "s.json", apply=True)
        qh.assert_called_once_with("a", "k")
        pe.assert_called_once_with("a", "k", {"idleTimeout": 30})
        self.assertTrue(report["changes"][0]["applied"])


if __name__ == "__main__":
    unittest.main()
