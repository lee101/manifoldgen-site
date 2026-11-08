"""CPU-only checks of the restyle score plumbing (no models): python -m pytest workers/voice-enhancer/tests."""
from fractions import Fraction
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import restyle  # noqa: E402

SHEETSAGE_MELODY = """X:1
T:
M:4/4
L:1/16
Q:1/4=88
V: Vocal clef=treble name="Vocal Melody" snm="Vocal"
V: Ins clef=treble name="Ins Melody" snm="Inst."
K:C
% verse
V: Vocal
E2G2A2G2E2D2C4|D2E2G2E2D2C2D4|E2G2A2c2B2A2G4|F2E2D2E2G2E2C4|
V: Ins
Z4|
% chorus
V: Vocal
G2A2c2B2A2G2E4|F2A2G2E2D2E2G4|A2c2B2A2G2E2D4|E2G2A2G2E2D2C4|
V: Ins
Z4|
"""


def test_condition_moves_the_melody_to_ins_and_retempos():
    score, transfer = restyle.condition(SHEETSAGE_MELODY, keep_harmony=False, bpm=72)
    facts = restyle.score_facts(score)
    assert transfer["vocal_notes_before"] == facts["ins_notes"] == 56
    assert "Q:1/4=72" in score and facts["bpm"] == 72 and facts["key"] == "C"
    assert abs(facts["nominal_seconds"] - 8 * 4 * 60 / 72) < 1e-6
    assert restyle.lyric_tags(score) == "[Verse]\n\n[Chorus]\n"


def test_style_pins_key_tempo_and_no_vocals():
    style = restyle.style_text("lofi hip hop, dusty drums.", "F#m", 80)
    assert style.startswith("Instrumental, lofi hip hop, dusty drums, F# minor, 80 BPM")
    for condition in restyle.NO_VOICE:
        assert condition in style
    assert restyle.style_text("Instrumental jazz", "C", 90).count("Instrumental") == 1


def test_key_and_chord_detection():
    c_major = np.zeros(12)
    c_major[[0, 2, 4, 5, 7, 9, 11]] = [5, 2, 4, 2, 4, 2, 1]
    assert restyle.detect_key(c_major) == "C"
    triad = np.zeros(12)
    triad[[9, 0, 4]] = 1
    assert restyle.chord_name(triad, 9, "C") == "Am"
    assert restyle.chord_name(np.zeros(12), None, "C") is None


def test_quarter_grid_starts_on_a_bar_line_before_zero():
    beats = np.arange(0.7, 20, 0.5)
    grid = restyle.quarter_grid(beats, beats[1::4], 4, 20.0)
    assert grid[0] <= 0 and grid[-1] >= 20
    first_downbeat = int(np.argmin(np.abs(grid - beats[1])))
    assert first_downbeat % 4 == 0


def test_sections_label_repeated_phrases():
    phrase = [(Fraction(i), Fraction(1), p) for i, p in enumerate([60, 62, 64, 65] * 4)]
    other = [(Fraction(16 + i), Fraction(1), p) for i, p in enumerate([67, 69, 71, 72] * 4)]
    lead = phrase + other + [(on + 32, d, p) for on, d, p in phrase] + [(on + 48, d, p) for on, d, p in phrase]
    labels = restyle.sections(lead, 20, 4)
    assert labels[0] == "intro" and labels[-1] == "outro" and len(labels) == 20
