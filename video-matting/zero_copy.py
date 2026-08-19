"""Optional NVDEC -> Torch -> NVENC transport with no raw host-frame copies.

The fallback pipeline in matting.py is deliberately portable. This module is
the production media path for Python >= 3.10 with PyNvVideoCodec 2.2+. Decoded
RGBP frames enter PyTorch through DLPack and the encoder consumes CUDA Array
Interface NV12 planes backed by a torch CUDA tensor.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator


def available() -> tuple[bool, str]:
    try:
        import PyNvVideoCodec  # noqa: F401
        import torch
    except Exception as exc:
        return False, f"optional PyNvVideoCodec backend unavailable: {exc}"
    if not torch.cuda.is_available():
        return False, "CUDA is unavailable to PyTorch"
    return True, "PyNvVideoCodec CUDA/DLPack backend available"


def decoded_rgbp(path: Path, gpu_id: int = 0) -> Iterator[tuple[object, object]]:
    """Yield (owner, CHW uint8 CUDA tensor); owner pins decoder storage."""
    import PyNvVideoCodec as nvc
    import torch

    decoder = nvc.SimpleDecoder(
        str(path), gpu_id=gpu_id, use_device_memory=True,
        output_color_type=nvc.OutputColorType.RGBP,
    )
    for index in range(len(decoder)):
        owner = decoder[index]
        tensor = torch.from_dlpack(owner)
        if tensor.ndim == 2:
            tensor = tensor.reshape(3, tensor.shape[0] // 3, tensor.shape[1])
        if tensor.ndim != 3 or tensor.shape[0] != 3:
            raise RuntimeError(f"unexpected RGBP decoder shape: {tuple(tensor.shape)}")
        yield owner, tensor


class _CudaArray:
    def __init__(self, shape, strides, pointer):
        self.__cuda_array_interface__ = {
            "shape": tuple(int(x) for x in shape),
            "strides": tuple(int(x) for x in strides),
            "data": (int(pointer), False),
            "typestr": "|u1",
            "version": 3,
        }


@dataclass
class Nv12TorchFrame:
    """NV12 surface owned by a contiguous CUDA uint8 tensor."""

    storage: object
    width: int
    height: int

    def cuda(self):
        base = self.storage.data_ptr()
        return [
            _CudaArray((self.height, self.width, 1), (self.width, 1, 1), base),
            _CudaArray(
                (self.height // 2, self.width // 2, 2),
                (self.width, 2, 1), base + self.width * self.height,
            ),
        ]


def rgb_to_nv12(rgb):
    """Convert CHW float RGB [0,1] to an NV12 CUDA surface using torch ops."""
    import torch
    import torch.nn.functional as functional

    if rgb.ndim == 4:
        rgb = rgb[0]
    _, height, width = rgb.shape
    if height % 2 or width % 2:
        raise ValueError("NV12 requires even dimensions")
    red, green, blue = rgb.float().clamp(0, 1).unbind(0)
    # Limited-range BT.709, matching normal HD WebM signalling.
    y = 16.0 + 219.0 * (0.2126 * red + 0.7152 * green + 0.0722 * blue)
    cb = 128.0 + 224.0 * (-0.114572 * red - 0.385428 * green + 0.5 * blue)
    cr = 128.0 + 224.0 * (0.5 * red - 0.454153 * green - 0.045847 * blue)
    cb = functional.avg_pool2d(cb[None, None], 2, 2)[0, 0]
    cr = functional.avg_pool2d(cr[None, None], 2, 2)[0, 0]
    storage = torch.empty(height * width * 3 // 2, dtype=torch.uint8, device=rgb.device)
    storage[: height * width].view(height, width).copy_(y.round().clamp(16, 235).byte())
    uv = storage[height * width :].view(height // 2, width // 2, 2)
    uv[..., 0].copy_(cb.round().clamp(16, 240).byte())
    uv[..., 1].copy_(cr.round().clamp(16, 240).byte())
    return Nv12TorchFrame(storage, width, height)


class Av1NvEncoder:
    """Thin zero-copy AV1 NVENC writer. Audio is stream-copied in a later mux step."""

    def __init__(self, output: Path, width: int, height: int, fps: int, gpu_id: int = 0):
        import PyNvVideoCodec as nvc

        self.nvc = nvc
        self.frame_index = 0
        self.encoder = nvc.CreateEncoder(
            width, height, "NV12", False, codec="av1", gpu_id=gpu_id,
            preset="P5", tuning_info="high_quality", rc="vbr",
            bitrate=12_000_000, maxbitrate=20_000_000, vbvbufsize=20_000_000,
            fps=fps, gop=max(fps * 2, 1), use_ivf_container="0",
        )
        extradata = self.encoder.GetSequenceParams()
        self.muxer = nvc.FFmpegMuxer(
            file_path=str(output), media_format=nvc.GetMediaFormat(str(output)), codec="av1",
            width=width, height=height, fps_num=fps, fps_den=1,
            timebase_num=1, timebase_den=90_000, extradata=extradata,
        )
        self.muxer.SetUniformPtsIncrement(90_000 // fps)

    def write(self, frame: Nv12TorchFrame) -> None:
        params = self.nvc.NV_ENC_PIC_PARAMS()
        params.inputTimeStamp = self.frame_index
        for packet in self.encoder.Encode(frame, params):
            self.muxer.MuxVideoPacket(bytes(packet["data"]), packet["picture_type"], packet["timestamp"])
        self.frame_index += 1

    def close(self) -> None:
        for packet in self.encoder.EndEncode():
            self.muxer.MuxVideoPacket(bytes(packet["data"]), packet["picture_type"], packet["timestamp"])
        self.muxer.Finalize()
