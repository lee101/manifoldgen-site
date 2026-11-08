from dataclasses import dataclass


@dataclass(frozen=True)
class Gpu:
    key: str
    name: str
    arch: str
    sms: int
    bw_gbs: float
    mem_gb: int
    bf16: float
    lin: float
    lin_fmt: str
    usd_hr: float
    measured: bool = False


GPUS = {g.key: g for g in [
    Gpu("h100", "H100 SXM 80GB", "sm_90", 132, 3350, 80, 989, 1979, "int8/fp8", 4.80, True),
    Gpu("h200", "H200 141GB", "sm_90", 132, 4800, 141, 989, 1979, "int8/fp8", 5.50),
    Gpu("b200", "B200 180GB", "sm_100", 148, 8000, 180, 2250, 9000, "nvfp4", 8.00),
    Gpu("pro6000", "RTX PRO 6000 96GB", "sm_120", 188, 1792, 96, 504, 2015, "nvfp4", 4.00, True),
    Gpu("5090", "RTX 5090 32GB", "sm_120", 170, 1792, 32, 210, 1676, "nvfp4", 1.20),
    Gpu("4090", "RTX 4090 24GB", "sm_89", 128, 1008, 24, 165, 330, "fp8", 0.70),
    Gpu("l40s", "L40S 48GB", "sm_89", 142, 864, 48, 362, 733, "fp8", 1.00),
    Gpu("a100", "A100 80GB", "sm_80", 108, 2039, 80, 312, 624, "int8", 1.90),
    Gpu("3090ti", "RTX 3090 Ti 24GB", "sm_86", 84, 1008, 24, 80, 320, "int8", 0.0),
    Gpu("3090", "RTX 3090 24GB", "sm_86", 82, 936, 24, 71, 284, "int8", 0.0),
]}
