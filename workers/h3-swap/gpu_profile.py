import importlib.util
import json
import os
import subprocess
from dataclasses import asdict, dataclass, replace
from pathlib import Path

COMFY_DIR = Path(os.environ.get("SWAP_COMFY_DIR", "/opt/ComfyUI"))


@dataclass(frozen=True)
class Gpu:
    name: str
    major: int
    minor: int
    vram_gb: float

    @property
    def arch(self):
        return f"sm_{self.major}{self.minor}"


@dataclass(frozen=True)
class Profile:
    name: str
    attention: str = "ck"
    vram: str = "normal"
    reserve_gb: float = 1.5
    max_megapixels: float = 0.98
    vae_tiled: bool = False
    compile: str = ""
    quant: str = "int8_convrot"
    dynamic_vram: bool = True
    verified: bool = False

    def as_dict(self):
        return asdict(self)


SAFE = Profile("safe", verified=True)

ARCH_FAMILY = {"sm_80": "ampere", "sm_86": "ampere", "sm_89": "ada", "sm_90": "hopper", "sm_100": "blackwell-dc", "sm_103": "blackwell-dc",
               "sm_120": "blackwell-ws", "sm_121": "blackwell-ws"}


def detect():
    forced = os.environ.get("SWAP_GPU_OVERRIDE")
    if forced:
        name, cc, mem = forced.split("|")
        major, minor = cc.split(".")
        return Gpu(name, int(major), int(minor), float(mem))
    try:
        line = subprocess.run(["nvidia-smi", "--query-gpu=name,compute_cap,memory.total", "--format=csv,noheader,nounits"],
                              capture_output=True, text=True, check=True, timeout=30).stdout.strip().splitlines()[0]
        name, cc, mem = [part.strip() for part in line.split(",")]
        major, minor = cc.split(".")
        return Gpu(name, int(major), int(minor), round(float(mem) / 1024, 1))
    except Exception:
        return Gpu("unknown", 0, 0, 0.0)


def importable(module):
    try:
        return importlib.util.find_spec(module) is not None
    except Exception:
        return False


def comfy_supports(flag):
    try:
        return flag in (COMFY_DIR / "comfy" / "cli_args.py").read_text(errors="replace")
    except OSError:
        return False


def attention_flag(attention):
    wanted = {"ck": ("--use-ck-attention", None), "sdpa": ("--use-pytorch-cross-attention", None),
              "flash": ("--use-flash-attention", "flash_attn"), "sage": ("--use-sage-attention", "sageattention")}
    flag, module = wanted.get(attention, wanted["sdpa"])
    if not comfy_supports(flag) or (module and not importable(module)):
        return None
    return flag


def with_env(profile):
    changes = {}
    for env, field, cast in (("SWAP_ATTENTION", "attention", str), ("SWAP_VRAM", "vram", str), ("SWAP_COMPILE", "compile", lambda v: "" if v == "off" else v),
                             ("SWAP_QUANT", "quant", str), ("SWAP_DYNAMIC_VRAM", "dynamic_vram", lambda v: v != "0"), ("SWAP_MAX_MP", "max_megapixels", float), ("SWAP_VAE_TILED", "vae_tiled", lambda v: v == "1")):
        if os.environ.get(env):
            changes[field] = cast(os.environ[env])
    return replace(profile, name=profile.name + "+env", verified=False, **changes) if changes else profile


def select(gpu=None):
    return with_env(select_base(gpu))


def select_base(gpu=None):
    gpu = gpu or detect()
    override = os.environ.get("SWAP_PROFILE")
    if override:
        return PROFILES.get(override, SAFE)
    family = ARCH_FAMILY.get(gpu.arch)
    big = gpu.vram_gb >= 90
    mid = 70 <= gpu.vram_gb < 90
    if family is None:
        return SAFE
    if family == "hopper" and gpu.vram_gb >= 130:
        return PROFILES["hopper-141"]
    if family == "hopper":
        return PROFILES["hopper-80"]
    if family == "blackwell-dc":
        return PROFILES["blackwell-dc-180"]
    if family == "blackwell-ws":
        return PROFILES["blackwell-ws-96"] if big else PROFILES["blackwell-ws-48"]
    if family == "ada":
        return PROFILES["ada-48"]
    if family == "ampere":
        return PROFILES["ampere-80"] if (mid or big) else PROFILES["ampere-48"]
    return SAFE


PROFILES = {
    "safe": SAFE,
    "hopper-80": Profile("hopper-80", verified=True),
    "hopper-141": Profile("hopper-141", verified=True),
    "blackwell-dc-180": Profile("blackwell-dc-180", verified=True),
    "blackwell-ws-96": Profile("blackwell-ws-96", verified=True),
    "blackwell-ws-48": Profile("blackwell-ws-48", vae_tiled=True),
    "ada-48": Profile("ada-48", vae_tiled=True, verified=True),
    "ampere-80": Profile("ampere-80", verified=True),
    "ampere-48": Profile("ampere-48", vae_tiled=True),
}


def comfy_flags(profile):
    flags = ["--disable-metadata", "--reserve-vram", str(profile.reserve_gb)]
    attention = attention_flag(profile.attention)
    if attention:
        flags.append(attention)
    if profile.vram == "high":
        flags.append("--highvram")
    elif profile.vram == "low":
        flags.append("--lowvram")
    if not profile.dynamic_vram and comfy_supports("--disable-dynamic-vram"):
        flags.append("--disable-dynamic-vram")
    return flags


def clamp_megapixels(requested, profile):
    return min(float(requested), profile.max_megapixels)


def describe(gpu, profile):
    return {"gpu": gpu.name, "arch": gpu.arch, "vram_gb": gpu.vram_gb, "profile": profile.name, "profile_verified": profile.verified,
            "attention": attention_flag(profile.attention) or "default", "vram": profile.vram, "max_megapixels": profile.max_megapixels,
            "vae_tiled": profile.vae_tiled, "compile": profile.compile or "off", "quant": profile.quant}


if __name__ == "__main__":
    selected = detect()
    print(json.dumps({**describe(selected, select(selected)), "flags": comfy_flags(select(selected))}))
