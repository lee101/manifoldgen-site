#!/usr/bin/env -S uv run --script
"""Show and widen the GPU pool of the character-swap RunPod endpoint. Dry run unless --apply is given.

  scale_pool.py status                    endpoint config, health and stock of every configured GPU type
  scale_pool.py widen [--apply]           add the missing config/runpod-h3-swap.json gpuTypeIds, in config priority order
  scale_pool.py order [--apply]           rewrite the endpoint list in config order (RunPod rents types in list order)
  scale_pool.py cuda [--apply]            replace allowedCudaVersions=[13.0] by minCudaVersion=13.0 (hosts on 13.1/13.2 drivers qualify)

Needs RUNPOD_API_KEY (or H3_RUNPOD_API_KEY) in the environment. Never prints it.
"""
import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

CONFIG = json.loads((pathlib.Path(__file__).resolve().parents[2] / "config/runpod-h3-swap.json").read_text())
ENDPOINT = CONFIG["endpoints"][0]["id"]
KEY = os.environ.get("RUNPOD_API_KEY") or os.environ.get("H3_RUNPOD_API_KEY") or sys.exit("RUNPOD_API_KEY is not set")
UA = {"User-Agent": "curl/8.10"}


def call(url, method="GET", body=None):
    request = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", **UA})
    try:
        return json.load(urllib.request.urlopen(request, timeout=60))
    except urllib.error.HTTPError as error:
        sys.exit(f"{error.code} {error.read()[:400].decode()}")


def stock():
    query = "{ gpuTypes { id memoryInGb lowestPrice(input:{gpuCount:1}){ stockStatus } } }"
    request = urllib.request.Request("https://api.runpod.io/graphql", method="POST", data=json.dumps({"query": query}).encode(),
                                     headers={"Authorization": "Bearer " + KEY, "Content-Type": "application/json", **UA})
    data = json.load(urllib.request.urlopen(request, timeout=60))["data"]["gpuTypes"]
    return {g["id"]: (g["memoryInGb"], (g.get("lowestPrice") or {}).get("stockStatus") or "None") for g in data}


def endpoint():
    return call(f"https://rest.runpod.io/v1/endpoints/{ENDPOINT}")


def patch(body, apply):
    print("PATCH", json.dumps(body))
    if apply:
        result = call(f"https://rest.runpod.io/v1/endpoints/{ENDPOINT}", "PATCH", body)
        print("applied; gpuTypeIds =", result.get("gpuTypeIds"), "allowedCudaVersions =", result.get("allowedCudaVersions"), "minCudaVersion =", result.get("minCudaVersion"))
        if "gpuTypeIds" in body and result.get("gpuTypeIds") != body["gpuTypeIds"]:
            print("warning: RunPod stored a different order or dropped types:", [g for g in body["gpuTypeIds"] if g not in result.get("gpuTypeIds", [])], "dropped")
    else:
        print("dry run: pass --apply to send")


def status():
    current = endpoint()
    health = call(f"https://api.runpod.ai/v2/{ENDPOINT}/health")
    print("workers", health["workers"], "jobs", health["jobs"])
    print("workersMax", current["workersMax"], "allowedCudaVersions", current.get("allowedCudaVersions"), "minCudaVersion", current.get("minCudaVersion"))
    levels = stock()
    for index, gpu in enumerate(CONFIG["endpoints"][0]["gpuTypeIds"]):
        memory, level = levels.get(gpu, (0, "unknown"))
        print(f"{index + 1:2d} {'in-pool' if gpu in current['gpuTypeIds'] else 'missing':8s} {gpu:55s} {memory:4d} GB  stock {level}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["status", "widen", "order", "cuda"])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--only-in-stock", action="store_true", help="skip types whose stock is None when widening")
    args = parser.parse_args()
    if args.command == "status":
        return status()
    wanted = CONFIG["endpoints"][0]["gpuTypeIds"]
    current = endpoint()
    if args.command == "cuda":
        return patch({"allowedCudaVersions": [], "minCudaVersion": "13.0"}, args.apply)
    if args.command == "order":
        return patch({"gpuTypeIds": [g for g in wanted if g in current["gpuTypeIds"]] + [g for g in current["gpuTypeIds"] if g not in wanted]}, args.apply)
    levels = stock() if args.only_in_stock else {}
    additions = [g for g in wanted if g not in current["gpuTypeIds"] and (not args.only_in_stock or levels.get(g, (0, "None"))[1] != "None")]
    if not additions:
        return print("pool already contains every configured GPU type")
    merged = [g for g in wanted if g in current["gpuTypeIds"] or g in additions] + [g for g in current["gpuTypeIds"] if g not in wanted]
    patch({"gpuTypeIds": merged}, args.apply)


main()
