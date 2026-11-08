import sys
sys.path.insert(0, "/vfast/data/code/vsrbench")
import comfy_kitchen
from flexwin import window_attention_flex

_orig = comfy_kitchen.window_attention


def _patched(q, k, v, windows, temporal_window=None, clamp=True, scale=None):
    ws = [windows] if windows and isinstance(windows[0], int) else windows
    if len(set(map(tuple, ws))) == 1:
        ws = ws[:1]
    kh = [int(a) for a, _ in ws]
    kw = [int(b) for _, b in ws]
    tw = k.shape[1] if temporal_window is None else temporal_window
    if q.is_cuda and not clamp:
        out = window_attention_flex(q, k, v, kh, kw, tw, clamp, scale)
        if out is not None:
            return out
    return _orig(q, k, v, windows, temporal_window, clamp, scale)


comfy_kitchen.window_attention = _patched
print("flexwin patch active")
NODE_CLASS_MAPPINGS = {}
