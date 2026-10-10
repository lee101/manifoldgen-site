import json
S = ["tram", "desert", "hum", "portrait"]
EC = [0.12, 0.15, 0.90]
base = {"unet": "fl2va", "vae": "fp16", "steps": 20, "easycache": EC}
V = [
 ("base", base),
 ("base_sla", {"unet": "fl2va", "vae": "fp16", "steps": 20, "attn": "sla"}),
 ("base12_sla", {"unet": "fl2va", "vae": "fp16", "steps": 12, "attn": "sla"}),
 ("f4", {"unet": "fused", "vae": "int8", "steps": 4, "shift": [12, 3]}),
 ("f4_sla", {"unet": "fused", "vae": "int8", "steps": 4, "shift": [12, 3], "attn": "sla"}),
 ("f6_sla", {"unet": "fused", "vae": "int8", "steps": 6, "shift": [12, 3], "attn": "sla"}),
 ("f8_sla", {"unet": "fused", "vae": "int8", "steps": 8, "shift": [12, 3], "attn": "sla"}),
 ("f4_sla_fastdec", {"unet": "fused", "vae": "int8", "steps": 4, "shift": [12, 3], "attn": "sla", "decode": "MiniMaxH3VAEDecodeFast", "decode_args": {"tiling": False, "tile_size": 512, "tile_overlap": 64, "output_device": "cpu", "temporal_tiling": False, "temporal_tile_frames": 85, "temporal_context_frames": 39}}),
 ("f4_sla_x2", {"unet": "fused", "vae": "x2", "steps": 4, "shift": [12, 3], "attn": "sla", "scale": 0.5, "decode": "MiniMaxH3VAEDecodeFast", "decode_args": {"tiling": False, "tile_size": 512, "tile_overlap": 64, "output_device": "cpu", "temporal_tiling": False, "temporal_tile_frames": 85, "temporal_context_frames": 39}}),
]
runs = []
for name, v in V:
    for s in S:
        runs.append({"name": name, "scene": s, "v": v, "seed": 7})
json.dump({"flags": ["--use-ck-attention"], "runs": runs}, open("jobs1.json", "w"))
print(len(runs))
