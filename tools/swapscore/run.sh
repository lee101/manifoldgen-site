#!/bin/sh
export UV_CACHE_DIR=/nvme0n1-disk/uvcache UV_PYTHON_INSTALL_DIR=/nvme0n1-disk/uvpython HOME=/nvme0n1-disk/uvcache/home
mkdir -p $HOME
exec uv run --script "$@"
