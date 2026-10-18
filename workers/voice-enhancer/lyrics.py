"""Speech-to-text with word timing, lyric sheet layout, and lyric-fidelity scoring."""
from __future__ import annotations

import re

import numpy as np

_MODEL = None


def _model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel
        _MODEL = WhisperModel("large-v3", device="cuda", compute_type="float16")
    return _MODEL


def _pass(y: np.ndarray, language: str, condition: bool) -> list[dict]:
    segments, _ = _model().transcribe(y, language=language, word_timestamps=True, beam_size=5,
                                      vad_filter=True, condition_on_previous_text=condition)
    return [{"start": s.start, "end": s.end, "text": s.text.strip(),
             "words": [{"w": w.word.strip(), "s": w.start, "e": w.end, "p": w.probability} for w in s.words]}
            for s in segments if s.text.strip()]


def looped(segments: list[dict]) -> bool:
    """Whisper's repetition failure: one short line repeated over most segments."""
    texts = [normalize(s["text"]) for s in segments]
    if len(texts) < 6:
        return False
    top = max(set(texts), key=texts.count)
    return texts.count(top) >= 0.4 * len(texts)


def transcribe(audio: np.ndarray, sr: int, language: str = "en", reference: str | None = None) -> list[dict]:
    """Segments with word timestamps; audio is mono float at any rate.

    Conditioned decoding follows fast rap best but can lock into a loop
    ("Yeah." x 20); unconditioned decoding never loops but drops chunks. With a
    ``reference`` both run and the closer transcript wins, otherwise the
    unconditioned pass is only the fallback for a detected loop.
    """
    import librosa
    y = librosa.resample(audio.astype(np.float32), orig_sr=sr, target_sr=16000) if sr != 16000 else audio
    y = y.astype(np.float32)
    first = _pass(y, language, True)
    if reference is None:
        return _pass(y, language, False) if looped(first) else first
    second = _pass(y, language, False)
    return min((first, second), key=lambda segs: wer(reference, text_of(segs)))


def words(segments: list[dict]) -> list[dict]:
    return [w for s in segments for w in s["words"] if w["w"]]


def lines(segments: list[dict], max_words: int = 16, gap: float = 0.35) -> list[dict]:
    """Re-cut the transcript into lyric lines at pauses, so a line is one breath/bar phrase."""
    out, current = [], []
    flat = words(segments)
    for i, w in enumerate(flat):
        if current and (w["s"] - current[-1]["e"] > gap or len(current) >= max_words):
            out.append(current)
            current = []
        current.append(w)
    if current:
        out.append(current)
    return [{"start": ws[0]["s"], "end": ws[-1]["e"], "words": ws,
             "text": " ".join(w["w"] for w in ws).strip(" ,.")} for ws in out]


def lyric_sheet(segments: list[dict], lines_per_verse: int = 8) -> str:
    """YuE-style sectioned lyrics. Whisper segments are already phrase-shaped."""
    rows = [s["text"].strip().rstrip(",.").strip() for s in segments]
    rows = [r[0].upper() + r[1:] for r in rows if r]
    sheet = []
    for i in range(0, len(rows), lines_per_verse):
        sheet.append("[Verse]")
        sheet.extend(rows[i:i + lines_per_verse])
    return "\n".join(sheet) + "\n"


def sheet_from_text(text: str, lines_per_verse: int = 8) -> str:
    """YuE lyric sheet from pasted lyrics: stanzas become sections, stray caps are tidied."""
    if re.search(r"^\s*\[[^\]]+\]\s*$", text, flags=re.M):
        return text.strip() + "\n"  # already sectioned by the writer
    def tidy(line: str) -> str:
        line = re.sub(r"\b([a-z]+)([A-Z][a-z]*)\b", lambda m: (m.group(1) + m.group(2)).lower(), line)
        line = re.sub(r"\s*—\s*", ", ", line).replace("’", "'").strip(" ,")
        return line[:1].upper() + line[1:]
    sheet = []
    for stanza in re.split(r"\n\s*\n", text.strip()):
        rows = [tidy(r) for r in stanza.split("\n") if r.strip()]
        for i in range(0, len(rows), lines_per_verse):
            sheet.append("[Verse]")
            sheet.extend(rows[i:i + lines_per_verse])
    return "\n".join(sheet) + "\n"


def normalize(text: str) -> str:
    text = text.lower().replace("’", "'")
    text = re.sub(r"\[[^\]]*\]", " ", text)
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def wer(reference: str, hypothesis: str) -> float:
    import jiwer
    ref, hyp = normalize(reference), normalize(hypothesis)
    return float(jiwer.wer(ref, hyp)) if ref else 1.0


def text_of(segments: list[dict]) -> str:
    return " ".join(s["text"] for s in segments)


def lyric_span(segments: list[dict], reference: str) -> dict:
    """Where a render actually performs the reference lyrics.

    Aligns the render's timed words to the reference in order. ``end`` is the
    last matched word that falls in the final 15% of the lyrics (the singer got
    to the end), ``coverage`` the fraction of reference words matched, and
    ``tail_unmatched`` how many words were sung after the lyrics ran out:
    invented filler or gibberish that should be cut.
    """
    from difflib import SequenceMatcher
    ref = normalize(reference).split()
    timed = [(normalize(w["w"]), w["s"], w["e"]) for w in words(segments)]
    timed = [t for t in timed if t[0]]
    hyp = [t[0] for t in timed]
    blocks = [b for b in SequenceMatcher(None, ref, hyp, autojunk=False).get_matching_blocks() if b.size]
    matched = sum(b.size for b in blocks)
    late = [b for b in blocks if b.a + b.size >= 0.85 * len(ref)]
    last = (late or blocks or [None])[-1]
    if last is None:
        return {"coverage": 0.0, "start": None, "end": None, "tail_unmatched": len(hyp)}
    end_index = last.b + last.size - 1
    return {"coverage": round(matched / max(1, len(ref)), 3), "start": timed[blocks[0].b][1],
            "end": timed[end_index][2], "reached_end": bool(late),
            "tail_unmatched": len(hyp) - 1 - end_index}
