#!/usr/bin/env python3
"""Watch the ManifoldGen H3 RunPod endpoints for stuck work, then triage with an agent.

Deterministic checks (run every ~5 min by deploy/manifoldgen-h3-monitor.timer, dry-run unless --apply):
  STUCK    workers running and jobs in progress, but the completed counter has not moved for --stuck-checks runs
  BACKLOG  jobs queued, no worker running or initializing, for --backlog-checks runs
  UNHEALTHY workers reported unhealthy/throttled
Remedy (--apply): STUCK recycles the endpoint (workersMax 0, wait, restore). RunPod then ends the hung jobs and
server/video.go recoverStuckFlexJob moves flex jobs to fal at the flex quote, so users still get their video.

Any issue also goes to a triage agent (diagnosis only, never edits). Tiers, first success wins:
  1 codex exec --model gpt-6.1-terra   (AUTOFIX_AGENT_BIN / H3_MONITOR_MODEL override)
  2 DeepSeek chat completions deepseek-flash (DEEPSEEK_API_KEY)
A tier that is missing, out of credits or failing falls through; with no tier left the deterministic summary is the report.
"""
from __future__ import annotations

import argparse, json, os, pathlib, shlex, subprocess, sys, time, urllib.error, urllib.request

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import runpod_cost_guard as guard  # noqa: E402  (shared REST helpers and send_alert)

PREFIXES = ("cog-manifold-h3",)


def detect(prev: dict, health: dict, stuck_checks: int = 3, backlog_checks: int = 3) -> tuple[dict, list[str]]:
    """Pure: previous per-endpoint state + a /health payload -> (new state, issues)."""
    jobs, workers = health.get("jobs") or {}, health.get("workers") or {}
    done, running = int(jobs.get("completed") or 0), int(workers.get("running") or 0)
    in_progress, queued = int(jobs.get("inProgress") or 0), int(jobs.get("inQueue") or 0)
    starting = int(workers.get("initializing") or 0) + int(workers.get("ready") or 0) + int(workers.get("idle") or 0)
    stalled = running > 0 and in_progress > 0 and done == prev.get("completed", done)
    starved = queued > 0 and running == 0 and starting == 0
    state = {"completed": done, "stuck": prev.get("stuck", 0) + 1 if stalled else 0,
             "backlog": prev.get("backlog", 0) + 1 if starved else 0}
    issues = []
    if state["stuck"] >= stuck_checks:
        issues.append(f"STUCK: {running} worker(s) running {in_progress} job(s), completed counter frozen at {done} for {state['stuck']} checks")
    if state["backlog"] >= backlog_checks:
        issues.append(f"BACKLOG: {queued} job(s) queued, no worker running or starting for {state['backlog']} checks")
    if int(workers.get("unhealthy") or 0) or int(workers.get("throttled") or 0):
        issues.append(f"UNHEALTHY: {workers.get('unhealthy', 0)} unhealthy, {workers.get('throttled', 0)} throttled workers")
    return state, issues


def triage_prompt(name: str, issues: list[str], health: dict, endpoint: dict) -> str:
    cfg = {k: endpoint.get(k) for k in ("workersMax", "idleTimeout", "gpuTypeIds", "executionTimeoutMs", "scalerValue")}
    return (
        "You are the on-call SRE for ManifoldGen's RunPod H3 video endpoints (Pika H3 Flex worker, repo /vfast/data/code/manifoldgen-site, "
        "worker /vfast/data/code/h3-cog-flex). Diagnose only; do not edit files or call write APIs. Known causes: worker hung after many jobs, "
        "weight download stalls on cold boot (35 GB from R2), no capacity for the listed GPU types, executionTimeout too long.\n"
        f"Endpoint {name}\nIssues: {json.dumps(issues)}\nHealth: {json.dumps(health)}\nConfig: {json.dumps(cfg)}\n"
        "Reply in under 150 words: most likely cause, one safe action, and what to check next."
    )


def tier_codex(prompt: str) -> str:
    binary = os.environ.get("AUTOFIX_AGENT_BIN") or os.environ.get("CODEX_AGENT_BIN") or "codex"
    model = os.environ.get("H3_MONITOR_MODEL", "gpt-6.1-terra")
    cmd = [binary, "exec", "--sandbox", "read-only", "--ephemeral", "--model", model, *shlex.split(os.environ.get("AUTOFIX_AGENT_EXTRA_ARGS", "")), prompt]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=240, cwd=str(HERE.parent))
    if out.returncode or not out.stdout.strip():
        raise RuntimeError(f"codex {model} rc={out.returncode}: {(out.stderr or out.stdout)[-200:]}")
    return out.stdout.strip()


def tier_deepseek(prompt: str) -> str:
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise RuntimeError("DEEPSEEK_API_KEY not set")
    body = json.dumps({"model": os.environ.get("H3_MONITOR_FALLBACK_MODEL", "deepseek-flash"), "max_tokens": 600,
                       "messages": [{"role": "user", "content": prompt}]}).encode()
    req = urllib.request.Request(os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com").rstrip("/") + "/chat/completions", body,
                                 {"Content-Type": "application/json", "Authorization": f"Bearer {key}", "User-Agent": "manifoldgen-h3-monitor/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.load(resp)["choices"][0]["message"]["content"].strip()


def triage(prompt: str, tiers=None) -> tuple[str, str]:
    errors = []
    for name, fn in tiers or (("gpt-6.1-terra", tier_codex), ("deepseek-flash", tier_deepseek)):
        try:
            return name, fn(prompt)
        except (OSError, RuntimeError, subprocess.SubprocessError, urllib.error.URLError, KeyError, ValueError) as err:
            errors.append(f"{name}: {str(err)[:160]}")
    return "none", "no triage agent available (" + "; ".join(errors) + ")"


def recycle(endpoint_id: str, key: str, previous_max: int, wait: float = 45) -> None:
    guard.patch_endpoint(endpoint_id, key, {"workersMax": 0, "workersMin": 0})
    time.sleep(wait)
    guard.patch_endpoint(endpoint_id, key, {"workersMax": previous_max})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--state", default=os.environ.get("H3_MONITOR_STATE", "/var/lib/manifoldgen-runpod-guard/h3-monitor.json"))
    ap.add_argument("--stuck-checks", type=int, default=3)
    ap.add_argument("--backlog-checks", type=int, default=3)
    a = ap.parse_args()
    guard.load_env(HERE.parent / ".env")
    key = os.environ.get("RUNPOD_API_KEY") or os.environ["H3_RUNPOD_API_KEY"]
    path = pathlib.Path(a.state)
    state = guard.read_state(path)
    endpoints = [e for e in guard.normalize_list(guard.request_json(f"{guard.REST_BASE}/endpoints", key)) if guard.managed_endpoint(e.get("name", ""), PREFIXES)]
    report = []
    for ep in endpoints:
        health = guard.queue_health(ep["id"], key)
        state[ep["id"]], issues = detect(state.get(ep["id"], {}), health, a.stuck_checks, a.backlog_checks)
        if not issues:
            continue
        who, text = triage(triage_prompt(ep["name"], issues, health, ep))
        action = "none"
        if any(i.startswith("STUCK") for i in issues) and int(ep.get("workersMax") or 0) > 0:
            action = "recycled workers" if a.apply else "would recycle workers (dry run)"
            if a.apply:
                recycle(ep["id"], key, int(ep["workersMax"]))
                state[ep["id"]]["stuck"] = 0
        detail = f"{ep['name']}: {'; '.join(issues)}\naction: {action}\ntriage ({who}): {text}"
        report.append(detail)
        guard.send_alert("h3-endpoint-issue", detail) if a.apply else print(detail)
    guard.write_state(path, state)
    print(json.dumps({"endpoints": len(endpoints), "issues": len(report)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
