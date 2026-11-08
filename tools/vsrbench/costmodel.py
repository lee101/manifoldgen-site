FPS = 24
MEAS_3090TI_SEC_PER_FRAME = {
    "t720_x2": 0.314,
    "t1080_x2": 0.726,
    "t540_x4": 0.93,
    "t270_x4": 0.184,
}
MAC_PER_IN_PX = {"x2plus": 4.5e6, "x4plus": 19.7e6}
IN_PX = {"t720_x2": 1280 * 720, "t1080_x2": 1920 * 1088, "t540_x4": 960 * 540, "t270_x4": 480 * 270}
OUT_MP = {"t720_x2": 2560 * 1440, "t1080_x2": 3840 * 2176, "t540_x4": 3840 * 2160, "t270_x4": 1920 * 1080}
MODEL = {"t720_x2": "x2plus", "t1080_x2": "x2plus", "t540_x4": "x4plus", "t270_x4": "x4plus"}
LABEL = {
    "t720_x2": "720p -> 1440p (2x)",
    "t1080_x2": "1080p -> 2176p/4K (2x)",
    "t540_x4": "540p -> 2160p (4x)",
    "t270_x4": "270p -> 1080p (4x)",
}

GPUS = {
    "3090 (24G)": (80, 0.75, 0.32),
    "4090 (24G)": (165, 1.34, 0.32),
    "5090 (32G)": (210, 1.79, 0.32),
    "A6000 (48G)": (77, 1.22, 0.32),
    "L40S (48G)": (362, 1.75, 0.32),
    "A100 (80G)": (312, 2.72, 0.30),
    "PRO 6000 (96G)": (504, 3.49, 0.25),
    "H100 (80G)": (989, 5.39, 0.20),
}

TFLOPS_3090TI = 80
REF_EFF = None


def eff_tflops_3090ti(key):
    flops = IN_PX[key] * MAC_PER_IN_PX[MODEL[key]] * 2
    return flops / MEAS_3090TI_SEC_PER_FRAME[key] / 1e12


def sec_per_frame(key, g):
    tflops, _, eff = GPUS[g]
    flops = IN_PX[key] * MAC_PER_IN_PX[MODEL[key]] * 2
    return flops / (tflops * eff * 1e12)


COLD_START_S = 30.0
IDLE_TAIL_S = 5.0
COLD_FRACTION = 0.5
MARKUP = 2.0


def job_cost(key, g, seconds):
    rate = GPUS[g][1] / 3600
    compute = sec_per_frame(key, g) * FPS * seconds
    overhead = COLD_FRACTION * COLD_START_S + IDLE_TAIL_S
    return compute * rate, overhead * rate


def old_price(key, seconds, scale):
    import math
    w, h = {"t720_x2": (1280, 720), "t1080_x2": (1920, 1088), "t540_x4": (960, 540), "t270_x4": (480, 270)}[key]
    mp = w * h * scale * scale / 1e6
    return math.ceil((0.10 + mp * seconds * 0.012) * 100 - 1e-9) / 100


def main():
    print("effective fp16 TFLOPS on measured 3090 Ti:")
    for k in IN_PX:
        print(f"  {LABEL[k]}: {eff_tflops_3090ti(k):.1f}")
    print()
    seconds = 5
    print(f"cost of a {seconds} s clip (compute + overhead share), cheapest GPU first, markup x{MARKUP}")
    for k in IN_PX:
        scale = 2 if MODEL[k] == "x2plus" else 4
        rows = []
        for g in GPUS:
            c, o = job_cost(k, g, seconds)
            rows.append((c + o, c, o, sec_per_frame(k, g) * FPS, g))
        rows.sort()
        print(f"\n{LABEL[k]}  (old price ${old_price(k, seconds, scale):.2f})")
        print("| GPU | s per output s | compute $ | overhead $ | total $ | $ per output s |")
        print("|---|---|---|---|---|---|")
        for tot, c, o, spo, g in rows:
            print(f"| {g} | {spo:.2f} | {c:.4f} | {o:.4f} | {tot:.4f} | {c / seconds:.5f} |")


main()
