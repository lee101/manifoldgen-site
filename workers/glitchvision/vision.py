"""Instance detection + segmentation for Deep Glitch: RT-DETR-v2 boxes prompt SAM2 masks.

Both models are Apache-2.0 (unlike ultralytics YOLO, which is AGPL) and run in fp16, optionally
through torch.compile (~2-3x faster; inductor caches to disk so only the first run pays warmup).
Detection runs every `every` frames; in between the last masks are held, which suits a glitch
look and halves the cost. Tracks keep ids across frames by IoU matching; boxes and mask logits
are EMA-smoothed so outlines do not jitter. Masks stay as 256x256 logits and are only upsampled
to full resolution when something actually reads track["mask"].
"""
import torch
import torch.nn.functional as F

DET_MODEL = "PekingU/rtdetr_v2_r18vd"
SAM_MODEL = "facebook/sam2.1-hiera-tiny"
LO = 256  # SAM2 mask resolution
SHARP = 0.9  # logit gain for the soft mask edge


def _iou(a, b):
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


class Track(dict):
    """A detected instance. `mask` (1xHxW, 0..1) is upsampled from low-res logits on first use."""

    def __missing__(self, key):
        if key != "mask":
            raise KeyError(key)
        lo = self["_lo"][None]
        self["mask"] = torch.sigmoid(F.interpolate(lo, size=self["_size"], mode="bilinear", align_corners=False)[0] * SHARP)
        return self["mask"]


class Instances:
    def __init__(self, device, every=2, threshold=0.4, max_instances=6, use_sam=True, compile=False):
        from transformers import RTDetrV2ForObjectDetection, Sam2Model

        self.dev, self.every, self.threshold, self.max_instances = device, every, threshold, max_instances
        self.det = RTDetrV2ForObjectDetection.from_pretrained(DET_MODEL).to(device).half().eval()
        self.names = self.det.config.id2label
        self.sam = Sam2Model.from_pretrained(SAM_MODEL).to(device).half().eval() if use_sam else None
        if compile:
            self.det = torch.compile(self.det)
            if self.sam:
                self.sam.vision_encoder = torch.compile(self.sam.vision_encoder)
        self.mean = torch.tensor([0.485, 0.456, 0.406], device=device).view(1, 3, 1, 1)
        self.std = torch.tensor([0.229, 0.224, 0.225], device=device).view(1, 3, 1, 1)
        self.tracks, self._next = [], 0

    @torch.inference_mode()
    def step(self, frame, depth, n):
        if self.tracks and n % self.every:
            return self.tracks
        _, h, w = frame.shape
        out = self.det(pixel_values=F.interpolate(frame[None], size=(640, 640), mode="bilinear", align_corners=False).half())
        prob = out.logits[0].float().softmax(-1)[:, :-1]
        score, label = prob.max(-1)
        cx, cy, bw, bh = out.pred_boxes[0].float().unbind(-1)
        rank = score * (bw * bh).sqrt() * (1 - 0.5 * (cx - 0.5).abs())  # prefer big, confident, central
        rank = torch.where(score > self.threshold, rank, torch.zeros_like(rank))
        top = rank.topk(min(self.max_instances, rank.numel())).indices
        top = top[rank[top] > 0]
        if top.numel() == 0:
            self.tracks = []
            return self.tracks
        boxes = torch.stack([cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2], -1)[top].clamp(0, 1)
        lo = self._logits(frame, boxes)
        fresh = [
            Track(box=[b[0] * w, b[1] * h, b[2] * w, b[3] * h], score=s, label=self.names[l], _lo=lo[i : i + 1], _size=(h, w))
            for i, (b, s, l) in enumerate(zip(boxes.cpu().tolist(), score[top].cpu().tolist(), label[top].cpu().tolist()))
        ]
        self.tracks = self._match(fresh, depth)
        return self.tracks

    def _logits(self, frame, boxes):
        if self.sam is None:  # boxes only: a rectangle expressed as logits
            ys = torch.linspace(0, 1, LO, device=self.dev).view(1, LO, 1)
            xs = torch.linspace(0, 1, LO, device=self.dev).view(1, 1, LO)
            b = boxes.view(-1, 4, 1, 1)
            inside = (xs > b[:, 0]) & (xs < b[:, 2]) & (ys > b[:, 1]) & (ys < b[:, 3])
            return inside.float() * 16 - 8
        pix = F.interpolate(frame[None], size=(1024, 1024), mode="bilinear", align_corners=False)
        emb = self.sam.get_image_embeddings(((pix - self.mean) / self.std).half())
        return self.sam(image_embeddings=emb, input_boxes=(boxes * 1024).half()[None], multimask_output=False).pred_masks[0, :, 0].float()

    def _match(self, fresh, depth):
        old, used = self.tracks, set()
        for f in fresh:
            best, best_iou = None, 0.3
            for t in old:
                if id(t) in used or t["label"] != f["label"]:
                    continue
                v = _iou(t["box"], f["box"])
                if v > best_iou:
                    best, best_iou = t, v
            if best:
                used.add(id(best))
                f["id"], f["age"] = best["id"], best["age"] + 1
                f["box"] = [a * 0.6 + b * 0.4 for a, b in zip(best["box"], f["box"])]
                f["_lo"] = f["_lo"] * 0.65 + best["_lo"] * 0.35
            else:
                self._next += 1
                f["id"], f["age"] = self._next, 0
        weights = torch.sigmoid(torch.cat([f["_lo"] for f in fresh]) * SHARP)  # n x LO x LO
        depth_lo = F.interpolate(depth[None], size=(LO, LO), mode="bilinear", align_corners=False)[0]
        means = ((weights * depth_lo).sum((1, 2)) / weights.sum((1, 2)).clamp(min=1.0)).tolist()  # one sync for all tracks
        for f, m in zip(fresh, means):
            f["depth"] = m
        fresh.sort(key=lambda t: -(t["label"] == "person") * 1e9 - t["score"] * (t["box"][2] - t["box"][0]) * (t["box"][3] - t["box"][1]))
        return fresh
