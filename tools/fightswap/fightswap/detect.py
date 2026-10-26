"""Per-shot cast detection: who is on screen and in what left-to-right order (Gemini vision on 3 keyframes)."""
from __future__ import annotations

import base64
import json
import os

import cv2
import requests

MODEL = os.environ.get("FIGHTSWAP_VISION", "gemini-3.5-flash")


def _frame_b64(video, t, max_w=640):
    cap = cv2.VideoCapture(str(video))
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, f = cap.read()
    cap.release()
    if not ok:
        return None
    if f.shape[1] > max_w:
        f = cv2.resize(f, (max_w, round(f.shape[0] * max_w / f.shape[1])))
    return base64.b64encode(cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 88])[1]).decode()


def detect_shot(video, start, end, roles: dict[str, str]):
    """roles: {key: costume description}. Returns {frames:[{people:[role keys left->right], faces:[bool]}], order, usable}."""
    ts = [start + (end - start) * f for f in (0.1, 0.5, 0.9)]
    imgs = [_frame_b64(video, t) for t in ts]
    role_txt = "; ".join(f"'{k}' = {v}" for k, v in roles.items())
    prompt = (f"These are 3 frames from one shot of a fight scene. Performers: {role_txt}. 'other' = anyone else (bystanders, background). "
              "For each frame list EVERY visible person left to right as role keys (or 'other'), whether each person's face is clearly visible, "
              "and whether burned-in subtitles are visible. Also give the overall framing of the shot: \"wide\" (full bodies small), \"medium\" (waist-up) or \"close\" (faces fill the frame). Return JSON: {\"framing\":\"wide|medium|close\",\"frames\":[{\"people\":[...],\"faces\":[true/false...],\"subtitles\":bool}]}")
    parts = [{"text": prompt}] + [{"inline_data": {"mime_type": "image/jpeg", "data": b}} for b in imgs if b]
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                      headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]}, timeout=120,
                      json={"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0}})
    r.raise_for_status()
    data = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    frames = data["frames"]
    orders = [tuple(p for p in f["people"] if p != "other") for f in frames]
    main = max(set(orders), key=orders.count)
    return {"framing": data.get("framing", "medium"), "frames": frames, "order": list(main), "stable": len(set(orders)) == 1,
            "n_people": len(main), "subtitles": any(f.get("subtitles") for f in frames),
            "all_faces": all(all(f.get("faces", [True])) for f in frames)}


def detect_segments(video, start, end, roles: dict[str, str], step=0.7, max_frames=12):
    """Dense pass for a shot whose cast changes (people walk in/out, swap sides): returns [(a, b, order, framing)] split where the
    ordered cast changes. One Gemini call over up to `max_frames` frames."""
    n = max(2, min(max_frames, int((end - start) / step) + 1))
    ts = [start + (end - start) * (i + 0.5) / n for i in range(n)]
    imgs = [_frame_b64(video, t, 480) for t in ts]
    role_txt = "; ".join(f"'{k}' = {v}" for k, v in roles.items())
    prompt = (f"{n} frames in time order from one fight shot. Performers: {role_txt}; 'other' = anyone else. For EACH frame list every visible person "
              "left to right as role keys (or 'other'). Return JSON {\"frames\":[{\"people\":[...]}]} with exactly one entry per frame.")
    parts = [{"text": prompt}] + [{"inline_data": {"mime_type": "image/jpeg", "data": b}} for b in imgs if b]
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                      headers={"x-goog-api-key": os.environ["GEMINI_API_KEY"]}, timeout=120,
                      json={"contents": [{"parts": parts}], "generationConfig": {"responseMimeType": "application/json", "temperature": 0}})
    r.raise_for_status()
    frames = json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])["frames"]
    orders = [tuple(p for p in f["people"] if p != "other") for f in frames][:n]
    segs, a = [], 0
    for i in range(1, len(orders) + 1):
        if i == len(orders) or orders[i] != orders[a]:
            lo = start if a == 0 else (ts[a - 1] + ts[a]) / 2
            hi = end if i == len(orders) else (ts[i - 1] + ts[i]) / 2
            segs.append((lo, hi, list(orders[a])))
            a = i
    return segs
