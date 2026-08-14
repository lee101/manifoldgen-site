FROM nvidia/cuda:12.6.3-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 HF_HOME=/runpod-volume/huggingface
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip git libgl1 libglib2.0-0 tesseract-ocr && rm -rf /var/lib/apt/lists/*
RUN pip3 install --upgrade pip && pip3 install --extra-index-url https://download.pytorch.org/whl/cu126 torch torchvision \
    && pip3 install runpod requests pillow boto3 pytesseract 'diffusers>=0.35.0' 'transformers>=4.48.0' accelerate safetensors \
    && SAM2_BUILD_CUDA=0 pip3 install 'git+https://github.com/facebookresearch/sam2.git'

WORKDIR /workspace
COPY handler.py /workspace/handler.py
CMD ["python3", "/workspace/handler.py"]
