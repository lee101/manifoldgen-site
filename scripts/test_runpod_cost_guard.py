#!/usr/bin/env python3

import unittest
import datetime as dt
import pathlib
import tempfile
from unittest.mock import patch

import runpod_cost_guard as guard

TODAY = "2026-09-23 00:00:00"
HEALTHY = {"clientBalance": 500.0, "currentSpendPerHr": 0.02, "underBalance": False}
_patches = []


def setUpModule():
    _patches.extend([patch.object(guard, "account_balance", return_value=HEALTHY), patch.object(guard, "customer_pod_ids", return_value=set()), patch.object(guard, "pod_gpu_utils", return_value={})])
    for item in _patches:
        item.start()


def tearDownModule():
    for item in _patches:
        item.stop()

GRAPHQL_OK = {"data": {"myself": {"clientBalance": 500.0, "currentSpendPerHr": 0.02}}}


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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
            self.assertEqual(method, "GET")
            if url.endswith("/endpoints"):
                return []
            if "/billing/" in url:
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

    def test_idle_gpu_pod_alerts_then_stops(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=3)).isoformat()
        pod = {"id": "idle", "name": "sweep-run", "desiredStatus": "RUNNING", "costPerHr": 2.69, "createdAt": created}
        with patch.object(guard, "pod_gpu_utils", return_value={"idle": 0.0}):
            report, calls, alerts = self.pod_runs([pod], checks=3)
            self.assertFalse(any(url.endswith("/stop") for _, url in calls))
            self.assertTrue(any("GPU idle" in item["status"] for item in report["pod_alerts"]))
            report, calls, _ = self.pod_runs([pod], checks=12)
        self.assertIn(("POST", f"{guard.REST_BASE}/pods/idle/stop"), calls)
        self.assertEqual(report["status"], "remediated")

    def test_busy_or_keep_or_customer_pods_are_not_idle_stopped(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=3)).isoformat()
        busy = {"id": "busy", "name": "train", "desiredStatus": "RUNNING", "costPerHr": 2.69, "createdAt": created}
        keep = {"id": "keep", "name": "keep-train", "desiredStatus": "RUNNING", "costPerHr": 2.69, "createdAt": created}
        cust = {"id": "cust", "name": "c", "desiredStatus": "RUNNING", "costPerHr": 2.69, "createdAt": created}
        with patch.object(guard, "pod_gpu_utils", return_value={"busy": 87.0, "keep": 0.0, "cust": 0.0}):
            report, calls, _ = self.pod_runs([busy, keep, cust], checks=13, customers={"cust"})
        self.assertFalse(any(url.endswith("/stop") for _, url in calls))
        self.assertEqual({item["id"] for item in report["pod_alerts"] if "GPU idle" in item["status"]}, {"keep"})

    def test_gpu_util_lookup_failure_never_stops(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=3)).isoformat()
        pod = {"id": "p", "name": "p", "desiredStatus": "RUNNING", "costPerHr": 2.69, "createdAt": created}
        with patch.object(guard, "pod_gpu_utils", side_effect=RuntimeError("graphql down")):
            report, calls, _ = self.pod_runs([pod], checks=13)
        self.assertFalse(any(url.endswith("/stop") for _, url in calls))
        self.assertTrue(any(err["scope"] == "pod_gpu_util" for err in report["errors"]))

    def pod_runs(self, pods, checks=2, customers=frozenset(), apply=True, balance=HEALTHY, health_error=None):
        calls = []

        def request(url, key, method="GET", payload=None, **kwargs):
            calls.append((method, url))
            if url.endswith("/endpoints"):
                return [{"id": "h3", "name": "cog-manifold-h3-normal", "workersMax": 1}] if health_error else []
            if url.endswith("/health"):
                raise RuntimeError(health_error)
            if "/billing/" in url or url.endswith("/networkvolumes"):
                return []
            if url.endswith("/pods"):
                return pods
            if url.endswith("/stop"):
                return {}
            raise AssertionError(url)
        alerts = []
        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request), \
                patch.object(guard, "customer_pod_ids", return_value=None if customers is None else set(customers)), \
                patch.object(guard, "account_balance", return_value=balance), \
                patch.object(guard, "send_alert", side_effect=lambda status, detail: alerts.append((status, detail)) or {}):
            for _ in range(checks):
                report = guard.run("key", pathlib.Path(work) / "state.json", 2, apply)
        return report, calls, alerts

    def test_costly_pod_alerts_early_then_stops_after_two_checks(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=14)).isoformat()
        pod = {"id": "h100", "name": "mystery", "desiredStatus": "RUNNING", "costPerHr": 3.49, "createdAt": created}
        report, calls, alerts = self.pod_runs([pod], checks=1)
        self.assertNotIn(("POST", f"{guard.REST_BASE}/pods/h100/stop"), calls)
        self.assertEqual(report["pod_alerts"][0]["id"], "h100")
        self.assertEqual(alerts[0][0], "account_cost")
        report, calls, alerts = self.pod_runs([pod], checks=2)
        self.assertIn(("POST", f"{guard.REST_BASE}/pods/h100/stop"), calls)
        self.assertEqual(report["status"], "remediated")
        self.assertTrue(any("stopped" in detail for _, detail in alerts))

    def test_customer_pods_are_never_stopped_or_alerted(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=30)).isoformat()
        pod = {"id": "cust", "name": "my-label", "desiredStatus": "RUNNING", "costPerHr": 3.49, "createdAt": created}
        report, calls, alerts = self.pod_runs([pod], checks=3, customers={"cust"})
        self.assertFalse(any(url.endswith("/stop") for _, url in calls))
        self.assertEqual(report["pod_alerts"], [])
        self.assertEqual(report["customer_pods"][0]["id"], "cust")

    def test_keep_prefixed_pods_alert_but_never_stop(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=30)).isoformat()
        pod = {"id": "k", "name": "keep-training", "desiredStatus": "RUNNING", "costPerHr": 3.49, "createdAt": created}
        report, calls, _ = self.pod_runs([pod], checks=3)
        self.assertFalse(any(url.endswith("/stop") for _, url in calls))
        self.assertEqual(report["pod_alerts"][0]["id"], "k")

    def test_unknown_customers_make_stop_alert_only(self):
        created = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(hours=30)).isoformat()
        pod = {"id": "x", "name": "x", "desiredStatus": "RUNNING", "costPerHr": 3.49, "createdAt": created}
        report, calls, _ = self.pod_runs([pod], checks=2, customers=None)
        self.assertFalse(any(url.endswith("/stop") for _, url in calls))
        self.assertIn("lookup failed", report["actions"][0]["skipped"])

    def test_low_balance_and_402_alert_without_error_exit(self):
        broke = {"clientBalance": -0.27, "currentSpendPerHr": 0.024, "underBalance": True}
        report, _, alerts = self.pod_runs([], checks=1, balance=broke, health_error="RunPod GET x returned 402: insufficient balance")
        self.assertEqual(report["status"], "warning")
        self.assertEqual(report["errors"], [])
        self.assertEqual(alerts[0][0], "account_balance")
        self.assertIn("exhausted", alerts[0][1])


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
        self.assertEqual(guard.daily_cap_usd("omniserve-qwen-mt-overflow"), 15.0)
        self.assertTrue(guard.managed_endpoint("omniserve-qwen-mt-overflow", guard.ALERT_ONLY_PREFIXES))
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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
            if method == "PATCH":
                patches.append((url.rsplit("/", 1)[-1], payload))
                for endpoint in self.ENDPOINTS:
                    if url.endswith("/" + endpoint["id"]):
                        endpoint["workersMax"] = payload["workersMax"]
                return {}
            if url.endswith("/endpoints"):
                return [dict(endpoint) for endpoint in self.ENDPOINTS]
            if "/billing/pods" in url:
                return []
            if "/billing/endpoints" in url:
                self.assertIn("bucketSize=day", url)
                return [{"endpointId": eid, "amount": amount, "time": TODAY} for eid, amount in state["spend"].items()]
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
                reports.append(guard.run("key", state_path, 6, True, now=self.NOW))
            cap_file = guard.json.loads((pathlib.Path(work) / "spend-caps.json").read_text())
            mode = (pathlib.Path(work) / "spend-caps.json").stat().st_mode & 0o777
        return reports, patches, alerts, cap_file, mode

    def setUp(self):
        for endpoint, value in zip(self.ENDPOINTS, (2, 1, 2, 3)):
            endpoint["workersMax"] = value
        account = patch.object(guard, "account_balance", return_value=HEALTHY)
        account.start()
        self.addCleanup(account.stop)

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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
            calls.append(method)
            if url.endswith("/endpoints"):
                return [dict(self.ENDPOINTS[0])]
            if "/billing/endpoints" in url:
                return [{"endpointId": "m3", "amount": 100, "time": TODAY}]
            if url.endswith("/health"):
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {}}
            return []

        with tempfile.TemporaryDirectory() as work, patch.object(guard, "request_json", side_effect=request), patch.object(guard, "send_alert") as alert:
            state_path = pathlib.Path(work) / "state.json"
            guard.run("key", state_path, 6, False, now=self.NOW)
            report = guard.run("key", state_path, 6, False, now=self.NOW)
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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
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
            if url == guard.GRAPHQL_URL:
                return GRAPHQL_OK
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


class AccountGuardTest(unittest.TestCase):
    NOW = dt.datetime(2026, 10, 8, 12, tzinfo=dt.timezone.utc)

    def run_guard(self, account, *, health_error=None, pods=None, volumes=None, endpoints=None, pod_spend=0.0, env=None, old_state=None):
        alerts = []
        endpoints = endpoints if endpoints is not None else [{"id": "h3", "name": "cog-manifold-h3-normal", "workersMax": 0, "workersMin": 0}]

        def request(url, key, method="GET", payload=None, **kwargs):
            if url == guard.GRAPHQL_URL:
                if isinstance(account, Exception):
                    raise account
                return {"data": {"myself": account}}
            if url.endswith("/endpoints"):
                return endpoints
            if "/billing/pods" in url:
                return [{"podId": "p", "amount": pod_spend, "time": "2026-10-08 00:00:00"}]
            if "/billing/endpoints" in url:
                return []
            if url.endswith("/health"):
                if health_error:
                    raise RuntimeError(health_error)
                return {"jobs": {"inProgress": 0, "inQueue": 0}, "workers": {}}
            if url.endswith("/pods"):
                return pods or []
            if url.endswith("/networkvolumes"):
                return volumes or []
            raise AssertionError(url)

        with tempfile.TemporaryDirectory() as work, \
                patch.object(guard, "request_json", side_effect=request), \
                patch.object(guard, "send_alert", side_effect=lambda status, detail: alerts.append((status, detail)) or {}), \
                patch.dict(guard.os.environ, env or {}):
            state_path = pathlib.Path(work) / "state.json"
            if old_state:
                guard.write_state(state_path, old_state)
            report = guard.run("key", state_path, 6, True, now=self.NOW)
        return report, alerts

    def test_402_is_a_single_balance_alert_not_endpoint_errors(self):
        endpoints = [{"id": "a", "name": "cog-manifold-h3-normal", "workersMax": 0}, {"id": "b", "name": "cog-manifold-h3-swap", "workersMax": 0}]
        report, alerts = self.run_guard({"clientBalance": -0.27, "currentSpendPerHr": 0.02}, health_error='RunPod GET x/health returned 402: {"title":"Insufficient Balance"}', endpoints=endpoints)
        self.assertEqual(report["errors"], [])
        self.assertTrue(report["balance_depleted"])
        self.assertEqual(report["status"], "warning")
        self.assertEqual(alerts[0][0], "account_balance")
        self.assertIn("exhausted", alerts[0][1])
        self.assertIn("below $5.00", alerts[0][1])

    def test_low_balance_and_short_runway_alert(self):
        report, alerts = self.run_guard({"clientBalance": 3.0, "currentSpendPerHr": 0.5})
        self.assertEqual(report["account"]["balance_usd"], 3.0)
        self.assertTrue(any("below $5.00" in item for item in report["account_alerts"]))
        report, _ = self.run_guard({"clientBalance": 30.0, "currentSpendPerHr": 5.0})
        self.assertTrue(any("lasts only 6.0 hours" in item for item in report["account_alerts"]))
        report, alerts = self.run_guard({"clientBalance": 200.0, "currentSpendPerHr": 0.02})
        self.assertEqual(report["account_alerts"], [])
        self.assertEqual(alerts, [])
        self.assertEqual(report["status"], "ok")

    def test_account_alert_is_not_resent_until_it_changes_or_six_hours_pass(self):
        account = {"clientBalance": 4.0, "currentSpendPerHr": 0.0}
        first, alerts = self.run_guard(account)
        self.assertEqual(len(alerts), 1)
        state = {key: first[key] for key in ("account_alert_digest", "account_alert_at")}
        _, alerts = self.run_guard(account, old_state=state)
        self.assertEqual(alerts, [])
        stale = dict(state, account_alert_at=(self.NOW - dt.timedelta(hours=7)).isoformat())
        _, alerts = self.run_guard(account, old_state=stale)
        self.assertEqual(len(alerts), 1)

    def test_other_account_query_failures_are_errors(self):
        report, _ = self.run_guard(RuntimeError("graphql down"))
        self.assertEqual(report["status"], "error")
        self.assertEqual(report["errors"][0]["scope"], "account")

    def test_direct_pod_spend_and_long_running_pods_alert(self):
        pods = [{"id": "p1", "name": "mystery", "desiredStatus": "RUNNING", "costPerHr": 3.5, "createdAt": (self.NOW - dt.timedelta(hours=7)).strftime("%Y-%m-%dT%H:%M:%SZ")}]
        report, alerts = self.run_guard({"clientBalance": 500.0, "currentSpendPerHr": 3.5}, pods=pods, pod_spend=60.19)
        self.assertEqual(report["spend"]["pods_usd"], 60.19)
        joined = "\n".join(report["account_alerts"])
        self.assertIn("direct Pod spend today $60.19", joined)
        self.assertIn("pod mystery (p1)", joined)
        self.assertEqual(report["actions"], [])
        young = [dict(pods[0], createdAt=(self.NOW - dt.timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))]
        report, _ = self.run_guard({"clientBalance": 500.0, "currentSpendPerHr": 3.5}, pods=young, pod_spend=1.0)
        self.assertEqual(report["pod_alerts"], [])

    def test_unattached_and_expensive_volumes_alert(self):
        volumes = [
            {"id": "used", "name": "models", "size": 150, "dataCenterId": "EU-NL-1"},
            {"id": "orphan", "name": "old-cache", "size": 100, "dataCenterId": "US-CA-2"},
        ]
        endpoints = [{"id": "h3", "name": "cog-manifold-h3-normal", "workersMax": 0, "networkVolumeId": "used"}]
        report, _ = self.run_guard({"clientBalance": 500.0, "currentSpendPerHr": 0.02}, volumes=volumes, endpoints=endpoints)
        self.assertEqual(report["storage_monthly_usd"], 17.5)
        self.assertEqual(len([item for item in report["account_alerts"] if "attached to no endpoint" in item]), 1)
        self.assertIn("old-cache", "\n".join(report["account_alerts"]))
        report, _ = self.run_guard({"clientBalance": 500.0, "currentSpendPerHr": 0.02}, volumes=volumes, endpoints=endpoints, env={"RUNPOD_COST_GUARD_STORAGE_MONTHLY_USD": "10"})
        self.assertTrue(any("above $10.00" in item for item in report["account_alerts"]))

    def test_attached_volume_ids_accepts_both_endpoint_shapes(self):
        endpoints = [{"networkVolumeId": "a"}, {"networkVolumeIds": ["b", {"networkVolumeId": "c"}]}, {}]
        self.assertEqual(guard.attached_volume_ids(endpoints), {"a", "b", "c"})


if __name__ == "__main__":
    unittest.main()
