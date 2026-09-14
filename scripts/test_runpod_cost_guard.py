#!/usr/bin/env python3

import unittest
import datetime as dt
import pathlib
import tempfile
from unittest.mock import patch

import runpod_cost_guard as guard


class RunPodCostGuardTest(unittest.TestCase):
    def test_only_expected_endpoint_prefixes_are_managed(self) -> None:
        self.assertTrue(guard.managed_endpoint("cog-manifold-h3-normal", guard.DEFAULT_PREFIXES))
        self.assertTrue(guard.managed_endpoint("omniserve-minimax-music3-xfast", guard.DEFAULT_PREFIXES))
        self.assertFalse(guard.managed_endpoint("customer-production-model", guard.DEFAULT_PREFIXES))

    def test_health_counts_jobs_and_all_worker_states(self) -> None:
        health = {
            "jobs": {"inProgress": 1, "inQueue": 2},
            "workers": {"idle": 1, "ready": 2, "initializing": 1, "unhealthy": 0},
        }
        self.assertEqual(guard.active_jobs(health), 3)
        self.assertEqual(guard.live_workers(health), 2)

    def test_consecutive_findings_reset_when_condition_clears(self) -> None:
        self.assertEqual(guard.consecutive(5, True), 6)
        self.assertEqual(guard.consecutive(5, False), 0)

    def test_normalize_runpod_list_shapes(self) -> None:
        self.assertEqual(guard.normalize_list([{"id": "a"}]), [{"id": "a"}])
        self.assertEqual(guard.normalize_list({"data": [{"id": "b"}]}), [{"id": "b"}])

    def test_pod_age_accepts_runpod_timestamp(self) -> None:
        now = dt.datetime(2026, 8, 26, 6, tzinfo=dt.timezone.utc)
        pod = {"createdAt": "2026-08-26 05:12:10.217 +0000 UTC"}
        self.assertAlmostEqual(guard.pod_age_hours(pod, now), 0.7972, places=3)


class RunPodCostInventoryTest(unittest.TestCase):
    def test_missing_health_never_counts_as_idle(self):
        for health in ({}, {"jobs": {}}, {"jobs": {"inProgress": 0}}):
            with self.assertRaises(ValueError):
                guard.active_jobs(health)

    def test_non_scratch_pods_and_storage_are_visible_but_not_deleted(self):
        def request(url, key, method="GET", payload=None, **kwargs):
            self.assertEqual(method, "GET")
            if url.endswith("/endpoints"):
                return []
            if url.endswith("/pods"):
                return [{"id": "failed-cog", "name": "cog-pixal3d-example", "desiredStatus": "RUNNING", "costPerHr": .34, "createdAt": "2020-01-01T00:00:00Z"}]
            if url.endswith("/networkvolumes"):
                return [{"id": "models", "name": "model-cache", "size": 256, "dataCenterId": "US-IL-1"}]
            raise AssertionError(url)
        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request):
            report = guard.run("test-key", pathlib.Path(work) / "state.json", 2, True)
        self.assertEqual(report["allocated_storage_gb"], 256)
        self.assertEqual(report["direct_pods"][0]["cost_per_hour"], .34)
        self.assertEqual(report["pod_alerts"][0]["id"], "failed-cog")
        self.assertEqual(report["actions"], [])
        self.assertEqual(report["status"], "warning")


if __name__ == "__main__":
    unittest.main()
