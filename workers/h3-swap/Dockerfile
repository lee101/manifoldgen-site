ARG BASE=ghcr.io/lee101/h3-swap:cu130-20261001-r4
FROM ${BASE}

ENV H3_MODERATION_DEVICE=cpu \
    MINIMAX_H3_LICENSE_ACCEPTED=1

COPY swap_graph.py swap_weights.py swap_relay.py swap_runtime.py gpu_profile.py swap_handler.py /src/
CMD ["python", "-u", "/src/swap_handler.py"]
