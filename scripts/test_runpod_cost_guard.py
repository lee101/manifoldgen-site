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
            "workers": {"idle": 1, "ready": 2, "initializing": 1, "unhealthy": 0, "throttled": 4},
        }
        self.assertEqual(guard.active_jobs(health), 3)
        self.assertEqual(guard.live_workers(health), 2)

    def test_consecutive_findings_reset_when_condition_clears(self) -> None:
        self.assertEqual(guard.consecutive(5, True), 6)
        self.assertEqual(guard.consecutive(5, False), 0)

    def test_throttled_demand_is_not_live_capacity(self) -> None:
        self.assertEqual(guard.live_workers({"workers": {"throttled": 2}}), 0)
        self.assertEqual(guard.live_workers({"workers": {"throttled": 2, "running": 1}}), 1)

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
            if "/billing/endpoints" in url:
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


class SpendCapTest(unittest.TestCase):
    NOW = dt.datetime(2026, 9, 23, 12, tzinfo=dt.timezone.utc)
    ENDPOINTS = [
        {"id": "m3", "name": "omniserve-minimax-music3-standard", "workersMax": 2, "workersMin": 0},
        {"id": "yue", "name": "omniserve-yue2-quality", "workersMax": 1, "workersMin": 0},
        {"id": "ra2", "name": "omniserve-ra2-overflow", "workersMax": 2, "workersMin": 0},
        {"id": "other", "name": "customer-model", "workersMax": 3, "workersMin": 0},
    ]

    def test_caps_and_prefixes(self):
        self.assertEqual(guard.daily_cap_usd("omniserve-minimax-music3-xfast"), 40.0)
        self.assertEqual(guard.daily_cap_usd("omniserve-yue2-quality"), 15.0)
        self.assertEqual(guard.daily_cap_usd("pixal3d"), 15.0)
        self.assertIsNone(guard.daily_cap_usd("customer-model"))
        self.assertTrue(guard.managed_endpoint("omniserve-yue2-quality", guard.DEFAULT_PREFIXES))
        self.assertFalse(guard.managed_endpoint("omniserve-ra2-overflow", guard.DEFAULT_PREFIXES))
        self.assertTrue(guard.managed_endpoint("cog-qwen-image-2.1-4c62f055", guard.ALERT_ONLY_PREFIXES))
        with patch.dict(guard.os.environ, {"RUNPOD_COST_GUARD_MUSIC3_DAILY_USD": "25"}):
            self.assertEqual(guard.daily_cap_usd("omniserve-minimax-music3-bf16"), 25.0)

    def test_daily_spend_filters_day(self):
        rows = [
            {"endpointId": "a", "amount": 1.5, "time": "2026-09-23 00:00:00"},
            {"endpointId": "a", "amount": 2.0, "time": "2026-09-23"},
            {"endpointId": "a", "amount": 99, "time": "2026-09-22 00:00:00"},
        ]
        self.assertEqual(guard.daily_spend(rows, "2026-09-23"), {"a": 3.5})

    def run_checks(self, spends, env=None):
        patches = []
        state = {}

        def request(url, key, method="GET", payload=None, **kwargs):
            if method == "PATCH":
                patches.append((url.rsplit("/", 1)[-1], payload))
                for endpoint in self.ENDPOINTS:
                    if url.endswith("/" + endpoint["id"]):
                        endpoint["workersMax"] = payload["workersMax"]
                return {}
            if url.endswith("/endpoints"):
                return [dict(endpoint) for endpoint in self.ENDPOINTS]
            if "/billing/endpoints" in url:
                self.assertIn("bucketSize=day", url)
                return [{"endpointId": eid, "amount": amount, "time": "2026-09-23 00:00:00"} for eid, amount in state["spend"].items()]
            if url.endswith("/health"):
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {}}
            if url.endswith("/pods") or url.endswith("/networkvolumes"):
                return []
            raise AssertionError(url)

        reports = []
        alerts = []
        with tempfile.TemporaryDirectory() as work, \
                patch.object(guard, "request_json", side_effect=request), \
                patch.object(guard, "send_alert", side_effect=lambda status, detail: alerts.append(detail) or {}), \
                patch.dict(guard.os.environ, env or {}):
            state_path = pathlib.Path(work) / "state.json"
            for spend in spends:
                state["spend"] = spend
                reports.append(guard.run("key", state_path, 6, True))
            cap_file = guard.json.loads((pathlib.Path(work) / "spend-caps.json").read_text())
            mode = (pathlib.Path(work) / "spend-caps.json").stat().st_mode & 0o777
        return reports, patches, alerts, cap_file, mode

    def setUp(self):
        for endpoint, value in zip(self.ENDPOINTS, (2, 1, 2, 3)):
            endpoint["workersMax"] = value

    def test_endpoint_cap_requires_two_checks_then_restores(self):
        reports, patches, alerts, cap_file, mode = self.run_checks(
            [{"m3": 41}, {"m3": 42}, {"m3": 43}, {"m3": 0}, {"m3": 0}]
        )
        self.assertEqual(reports[0]["actions"], [])
        self.assertEqual(patches, [("m3", {"workersMax": 0}), ("m3", {"workersMax": 2})])
        self.assertEqual(reports[1]["capped"]["m3"]["prior_workers_max"], 2)
        self.assertEqual(reports[1]["status"], "remediated")
        self.assertTrue(any("omniserve-minimax-music3-standard" in item for item in alerts))
        self.assertIn("m3", reports[3]["capped"])
        self.assertEqual(reports[3]["actions"], [])
        self.assertEqual(reports[4]["capped"], {})
        self.assertEqual(cap_file["capped"], {})
        self.assertEqual(mode, 0o644)

    def test_alert_only_endpoints_are_never_patched(self):
        reports, patches, alerts, _, _ = self.run_checks([{"ra2": 20, "other": 500}, {"ra2": 21, "other": 500}], {"RUNPOD_COST_GUARD_GLOBAL_DAILY_USD": "10000"})
        self.assertEqual(patches, [])
        self.assertTrue(any("alert-only" in item and "omniserve-ra2-overflow" in item for item in alerts))
        self.assertEqual(reports[1]["status"], "warning")

    def test_global_cap_stops_spending_owned_endpoints_only(self):
        reports, patches, alerts, cap_file, _ = self.run_checks([{"yue": 1, "other": 200}, {"yue": 1, "other": 200}])
        self.assertEqual(patches, [("yue", {"workersMax": 0})])
        self.assertIn("yue", cap_file["capped"])
        self.assertTrue(any("global cap" in item for item in alerts))

    def test_dry_run_does_not_patch_or_record_caps(self):
        calls = []

        def request(url, key, method="GET", payload=None, **kwargs):
            calls.append(method)
            if url.endswith("/endpoints"):
                return [dict(self.ENDPOINTS[0])]
            if "/billing/endpoints" in url:
                return [{"endpointId": "m3", "amount": 100, "time": "2026-09-23 00:00:00"}]
            if url.endswith("/health"):
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {}}
            return []

        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request), patch.object(guard, "send_alert") as alert:
            state_path = pathlib.Path(work) / "state.json"
            guard.run("key", state_path, 6, False)
            report = guard.run("key", state_path, 6, False)
            self.assertFalse((pathlib.Path(work) / "spend-caps.json").exists())
        self.assertNotIn("PATCH", calls)
        self.assertEqual(report["capped"], {})
        self.assertFalse(report["actions"][0]["applied"])
        alert.assert_not_called()

    def test_omniserve_yue_idle_worker_is_remediated(self):
        endpoints = [
            {"id": "yue", "name": "omniserve-yue2-quality", "workersMax": 1, "workersMin": 0},
            {"id": "h3", "name": "cog-manifold-h3-normal", "workersMax": 1, "workersMin": 0},
        ]
        patches = []

        def request(url, key, method="GET", payload=None, **kwargs):
            if method == "PATCH":
                patches.append((url.rsplit("/", 1)[-1], payload))
                return {}
            if url.endswith("/endpoints"):
                return endpoints
            if "/billing/endpoints" in url:
                return []
            if url.endswith("/health"):
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {"idle": 1}}
            return []

        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request):
            state_path = pathlib.Path(work) / "state.json"
            for _ in range(2):
                report = guard.run("key", state_path, 2, True)
        # Raising capacity is a per-request step in the music lane, so zeroing the
        # idle endpoint is safe and must not stay alert-only.
        self.assertEqual(patches, [("yue", {"workersMax": 0}), ("h3", {"workersMax": 0})])
        self.assertEqual(report["idle_alerts"], [])

    def test_flashboot_standby_workers_are_not_idle_capacity(self):
        endpoints = [
            {
                "id": "yue",
                "name": "omniserve-yue2-quality",
                "workersMax": 1,
                "workersMin": 0,
                "workersStandby": 1,
            }
        ]
        health = {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {"idle": 1, "ready": 1}}

        def request(url, key, method="GET", payload=None, **kwargs):
            if url.endswith("/endpoints"):
                return endpoints
            if "/billing/endpoints" in url:
                return []
            if url.endswith("/health"):
                return health
            return []

        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request):
            state_path = pathlib.Path(work) / "state.json"
            for _ in range(3):
                report = guard.run("key", state_path, 2, True)
        self.assertEqual(report["actions"], [])
        self.assertEqual(report["idle_alerts"], [])
        self.assertEqual(report["counts"]["yue"]["idle_live"], 0)
        self.assertEqual(report["endpoints"][0]["standby_workers"], 1)
        self.assertEqual(report["endpoints"][0]["active_workers"], 0)

    def test_errors_survive_successful_remediation_and_archive_failure(self):
        for archive_error in (False, True):
            with self.subTest(archive_error=archive_error):
                def spend(report, *args):
                    report["actions"].append({"applied": True})
                    if not archive_error:
                        report["errors"].append({"scope": "spend", "error": "unavailable"})
                    return []

                with tempfile.TemporaryDirectory() as work, \
                        patch.object(guard, "request_json", return_value=[]), \
                        patch.object(guard, "spend_guard", side_effect=spend), \
                        patch.object(guard, "archive_guard", side_effect=RuntimeError("archive unavailable") if archive_error else None, return_value=[]):
                    report = guard.run("key", pathlib.Path(work) / "state.json", 2, False)
                self.assertEqual(report["status"], "error")

    def test_archived_endpoint_with_capacity_is_zeroed_and_alerted(self):
        endpoints = [
            {"id": "ctl", "name": "manifold-h3-control-union-is", "workersMax": 1, "workersMin": 0},
            {"id": "yue", "name": "omniserve-yue2-quality", "workersMax": 1, "workersMin": 0},
        ]
        patches = []

        def request(url, key, method="GET", payload=None, **kwargs):
            if method == "PATCH":
                patches.append((url.rsplit("/", 1)[-1], payload))
                return {}
            if url.endswith("/endpoints"):
                return endpoints
            if url.endswith("/health"):
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {}}
            return []

        alerts = []
        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request), \
                patch.object(guard, "send_alert", side_effect=lambda status, detail: alerts.append(detail) or {}), \
                patch.dict(guard.os.environ, {"RUNPOD_ARCHIVED_ENDPOINT_IDS": "ctl,lm0"}):
            report = guard.run("key", pathlib.Path(work) / "state.json", 6, True)
        self.assertEqual(patches, [("ctl", {"workersMin": 0, "workersMax": 0})])
        self.assertEqual(report["status"], "remediated")
        self.assertTrue(any("archived" in item and "ctl" in item for item in alerts))

    def test_restore_command(self):
        with tempfile.TemporaryDirectory() as work, patch.object(guard, "patch_endpoint") as patched:
            state_path = pathlib.Path(work) / "state.json"
            guard.write_state(state_path, {"capped": {"m3": {"prior_workers_max": 2}}})
            result = guard.restore_endpoint("key", state_path, pathlib.Path(work) / "caps.json", "m3")
            self.assertEqual(result["workersMax"], 2)
            patched.assert_called_once_with("m3", "key", {"workersMax": 2})
            self.assertEqual(guard.read_state(state_path)["capped"], {})


if __name__ == "__main__":
    unittest.main()
