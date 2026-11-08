LAYERS = 50
HEADS = 56
HEAD_DIM = 128
HIDDEN = 5376
FFN = 14336
PREFIX = 530
N0 = 37826
STEPS = 6
LAT_PER_FRAME = 37 / 124

ATTN_TFLOPS = {
    ("h100", "ck"): ((37826, 447.0),),
    ("h100", "cudnn"): ((37826, 550.0),),
    ("h100", "flash"): ((37826, 372.0),),
    ("pro6000", "ck"): ((37826, 564.0), (76010, 606.0)),
    ("pro6000", "cudnn"): ((37826, 382.0), (76010, 381.0)),
    ("pro6000", "flash"): ((37826, 366.0), (76010, 367.0)),
}
REST_STEP_S = {"h100": 2.43, "pro6000": 2.36}
OVERHEAD_S = {"h100": 37.5, "pro6000": 19.0}


def tokens(w, h, frames):
    return round(frames * LAT_PER_FRAME) * (w // 32) * (h // 32) + PREFIX


def eff(gpu, backend, n):
    pts = ATTN_TFLOPS[(gpu, backend)]
    if len(pts) == 1 or n <= pts[0][0]:
        return pts[0][1]
    if n >= pts[-1][0]:
        return pts[-1][1]
    (n0, e0), (n1, e1) = pts[0], pts[-1]
    return e0 + (e1 - e0) * (n - n0) / (n1 - n0)


def attn_layer_s(gpu, backend, n, density=1.0):
    return density * 4.0 * n * n * HEADS * HEAD_DIM / (eff(gpu, backend, n) * 1e12)


def step_s(gpu, backend, n, densities=None):
    ds = densities if densities is not None else [1.0] * LAYERS
    return REST_STEP_S[gpu] * n / N0 + sum(attn_layer_s(gpu, backend, n, d) for d in ds)


def gen_s(gpu, backend, n, densities=None, steps=STEPS):
    return steps * step_s(gpu, backend, n, densities) + OVERHEAD_S[gpu] * n / N0


def schedule(dense_layers, density):
    return [1.0] * dense_layers + [density] * (LAYERS - dense_layers)
