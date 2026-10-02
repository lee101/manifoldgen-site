FROM ghcr.io/lee101/h3-cog:cu130-20260826-face-judge-r7

ENV H3_MODERATION_DEVICE=cpu \
    MINIMAX_H3_LICENSE_ACCEPTED=1

COPY swap_graph.py swap_weights.py swap_runtime.py swap_handler.py /src/
CMD ["python", "-u", "/src/swap_handler.py"]
