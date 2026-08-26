#!/usr/bin/env python3

import unittest
import datetime as dt

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


if __name__ == "__main__":
    unittest.main()
