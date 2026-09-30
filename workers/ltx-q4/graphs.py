Q4 = "ltxv23_uncensored_v1.4_Q4_K_M.gguf"
FP8 = "ltxv23_uncensored_v1.4_fp8mixed.safetensors"
TEXT_ENCODER = "gemma-3-12b-it-ablit-norms-biproj-Q4_K_M.gguf"
PROJECTIONS = "ltxv23_uncensored_v1.4_projections.safetensors"
VIDEO_VAE = "ltxv23_uncensored_v1.4_video_vae.safetensors"
AUDIO_VAE = "ltxv23_uncensored_v1.4_audio_vae.safetensors"
UPSCALER = "ltx-2.3-spatial-upscaler-x2-1.0.safetensors"

NEGATIVE = (
    "missing limbs, deformities, low quality, idle movement, low motion, text, signature, fonts, printed words, "
    "watermark, logo, website url, nnbycam.com, caption, subtitles, blank screens, hard cuts between scenes"
)


def build(prompt, *, width, height, frames, seed, unet=Q4, two_stage=False, steps=8, cfg=3.5,
          refine_steps=4, negative=NEGATIVE, fps=24.0, image=None, audio=None, prefix="video/ltx", attention_compile=False):
    base_w, base_h = (width // 2, height // 2) if two_stage else (width, height)
    g = {
        "1": {"class_type": "LTXV23ModelsLoader", "inputs": {
            "unet_name": unet, "text_encoder_name": TEXT_ENCODER, "projections_name": PROJECTIONS,
            "video_vae_name": VIDEO_VAE, "audio_vae_name": AUDIO_VAE}},
        "2": {"class_type": "LTXV23ImgToVideo", "inputs": {
            "clip": ["1", 1], "vae": ["1", 2], "audio_vae": ["1", 3], "prompt": prompt,
            "negative_prompt": negative, "width": base_w, "height": base_h, "length": frames,
            "frame_rate": fps, "batch_size": 1}},
    }
    if image:
        g["6"] = {"class_type": "LoadImage", "inputs": {"image": image}}
        g["2"]["inputs"]["image"] = ["6", 0]
    if audio:
        g["9"] = {"class_type": "LoadAudio", "inputs": {"audio": audio}}
        g["2"]["inputs"]["reference_audio"] = ["9", 0]
    model = ["1", 0]
    if attention_compile:
        g["7"] = {"class_type": "TorchCompileModel", "inputs": {"model": model, "backend": "inductor"}}
        model = ["7", 0]
    if two_stage:
        g["8"] = {"class_type": "LatentUpscaleModelLoader", "inputs": {"model_name": UPSCALER}}
        g["3"] = {"class_type": "LTXV23RefineSampler", "inputs": {
            "model": model, "positive": ["2", 0], "negative": ["2", 1], "latent_image": ["2", 2],
            "upscale_model": ["8", 0], "vae": ["1", 2], "seed": seed, "base_schedule": "dmd (8 steps)",
            "base_steps": steps, "refine_seed": seed + 1,
            "refine_schedule": "dmd upscale (4 steps)" if refine_steps == 4 else "refine (3 steps)",
            "refine_steps": refine_steps, "cfg": cfg, "sampler_name": "euler_ancestral"}}
    else:
        g["3"] = {"class_type": "LTXV23KSampler", "inputs": {
            "model": model, "positive": ["2", 0], "negative": ["2", 1], "latent_image": ["2", 2],
            "seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler_ancestral",
            "schedule": "dmd (8 steps)", "denoise": 1.0}}
    g["4"] = {"class_type": "LTXV23AVDecode", "inputs": {
        "latent": ["3", 0], "vae": ["1", 2], "audio_vae": ["1", 3], "fps": fps}}
    g["5"] = {"class_type": "SaveVideo", "inputs": {
        "video": ["4", 0], "filename_prefix": prefix, "format": "auto", "codec": "auto"}}
    return g
