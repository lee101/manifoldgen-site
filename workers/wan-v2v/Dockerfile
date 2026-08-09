FROM ghcr.io/lee101/accelerated-cgtaylor-wan-app-nz:t2v

COPY predict.py /src/predict.py
COPY patch_schema.py /tmp/patch_schema.py
RUN python /tmp/patch_schema.py \
    && pip install --no-cache-dir runpod requests imageio imageio-ffmpeg ftfy \
    && rm /tmp/patch_schema.py

COPY rp_cog_handler.py /rp_cog_handler.py
COPY entry.sh /sls-entry.sh
RUN chmod +x /sls-entry.sh

ENV COG_PREDICT_TYPE_STUB=predict.py:Predictor

# app.nz runs this image in two modes: a normal Cog HTTP server on a warm pod,
# or a RunPod queue worker when RUNPOD_ENDPOINT_ID is present.
ENTRYPOINT ["/sls-entry.sh"]
