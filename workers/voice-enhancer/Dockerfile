# Voice enhancer / lyric music worker (RunPod serverless).
# Built from a staged context: scripts/stage_image.sh copies code, Seed-VC and model weights.
FROM ghcr.io/lee101/yue-cog@sha256:33d2154e8399e3919a874279614319e53ca885a9132abaec3b3354e171dc321e

ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models/hf HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 TORCH_HOME=/models/torch \
    VE_SEPARATOR_DIR=/models/separator SEED_VC_DIR=/opt/seed-vc YUE_PYTHON=/usr/local/bin/python \
    SHEETSAGE2_PYTHON=/opt/sheetsage2/.venv/bin/python RESTYLE_TRANSCRIBER=basic-pitch \
    YUE_DEVICE=cuda

COPY requirements.txt constraints.txt requirements-seedvc.txt requirements-sheetsage2.txt /tmp/
RUN pip install --extra-index-url https://download.pytorch.org/whl/cu128 -r /tmp/requirements.txt -c /tmp/constraints.txt
# basic-pitch declares TensorFlow on Linux; restyle only loads its bundled ONNX model.
RUN pip install --no-deps basic-pitch==0.4.0

# SheetSage2 (music restyle transcription) pins transformers 4.45 and numpy<2;
# its venv reuses the image's torch and overrides only those pins.
RUN python -m venv --system-site-packages /opt/sheetsage2/.venv \
 && /opt/sheetsage2/.venv/bin/pip install -r /tmp/requirements-sheetsage2.txt

COPY seed-vc /opt/seed-vc
# torch comes from the system site-packages; only Seed-VC's own pins land in the venv.
RUN python -m venv --system-site-packages /opt/seed-vc/.venv \
 && /opt/seed-vc/.venv/bin/pip install -r /tmp/requirements-seedvc.txt

COPY models /models
COPY app /src/ve
WORKDIR /src/ve
ENTRYPOINT []
CMD ["python", "-u", "/src/ve/handler.py"]
