FROM ghcr.io/lee101/h3-cog:cu130-20260821-face-upscaler

ARG VIDEOX_REV=b0acf916c215705ac212fc51b2d9007bbc6df51b
ENV HF_HOME=/runpod-volume/huggingface \
    H3_MODEL_DIR=/runpod-volume/models/minimax-h3 \
    H3_CONTROL_DIR=/runpod-volume/models/minimax-h3-control \
    PYTHONPATH=/opt/VideoX-Fun \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN git clone https://github.com/aigc-apps/VideoX-Fun.git /opt/VideoX-Fun \
 && git -C /opt/VideoX-Fun checkout "$VIDEOX_REV" \
 && pip install --no-deps /opt/VideoX-Fun \
 && pip install runpod==1.8.1 einops safetensors timm tomesd torchdiffeq torchsde decord \
      scikit-image omegaconf sentencepiece 'imageio[ffmpeg,pyav]' ftfy func-timeout \
      accelerate==1.12.0 diffusers==0.36.0 transformers==4.57.6 controlnet-aux==0.0.10 \
      librosa datasets albumentations tensorboard beautifulsoup4 gradio==5.49.1

WORKDIR /src
COPY runtime.py preprocess.py handler.py /src/
CMD ["python", "-u", "/src/handler.py"]
