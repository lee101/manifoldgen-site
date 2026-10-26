"""Detached pod killer (pattern from openkernels/rp.py): deletes the pod at its TTL even if the session that started it died.
Usage: python -m fightswap.watchdog <pod_id> <ttl_epoch>"""
import sys
import time

from . import cloud, pod


def main():
    pod_id, ttl = sys.argv[1], float(sys.argv[2])
    while time.time() < ttl:
        time.sleep(min(30, max(ttl - time.time(), 1)))
        st = pod.state()
        if not st or st["id"] != pod_id:  # already torn down
            return
    cloud.load_env()
    p = pod._probe()
    try:
        p.call(f"/pods/{pod_id}", "DELETE")
    finally:
        st = pod.state()
        if st and st["id"] == pod_id:
            pod.STATE.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
