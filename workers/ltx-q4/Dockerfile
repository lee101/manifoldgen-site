FROM ghcr.io/lee101/h3-cog:cu130-20260826-face-judge-r7

ARG LTX_NODE_REV=142c614fe6852f18a513742cc098fd13d72320a9
ARG LTX_UNET_FILE=ltxv23_uncensored_v1.4_fp8mixed.safetensors
ENV LTX_COMFY_DIR=/opt/ComfyUI \
    LTX_UNET=${LTX_UNET_FILE} \
    H3_MODERATION_DEVICE=cpu

RUN python -m pip install --break-system-packages --no-cache-dir "gguf>=0.13.0" sentencepiece protobuf \
    && git clone https://github.com/ChrisColeTech/ComfyUI-GGUF-Loader /opt/ComfyUI/custom_nodes/ComfyUI-GGUF-Loader \
    && git -C /opt/ComfyUI/custom_nodes/ComfyUI-GGUF-Loader checkout ${LTX_NODE_REV}

COPY graphs.py weights.py ltx_runtime.py ltx_handler.py /src/
CMD ["python", "-u", "/src/ltx_handler.py"]
