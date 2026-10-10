# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""One stem of a pack: a held vowel (or a few, for the choir) moved to the zone root,
trimmed, levelled and looped."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.signal import butter, sosfiltfilt

from held_notes import HeldNote, read_mono
from loops import Loop, bake_crossfade, find_loop
from pitch_shift import PSOLA_LIMIT, resample, shift
from vocalset import SourceFile

RATE = 48_000
# The pack keeps 16 kHz of bandwidth (a 32 kHz signal) at the Opus rate.
BANDWIDTH_HZ = 16_000
STEM_SECONDS = 1.2
LOOP_START_SECONDS = 0.3
FADE_IN_SECONDS = 0.012
TARGET_RMS = 0.12
# Room on each side of a segment so the shifts have whole periods to work with.
MARGIN_SECONDS = 0.08


@dataclass(frozen=True)
class Take:
    """A held note of one recording, and how it enters a stem."""

    source: SourceFile
    note: HeldNote
    delay_seconds: float = 0.0
    detune_cents: float = 0.0


@dataclass
class Stem:
    samples: np.ndarray
    loop: Loop
    root: float
    takes: list[Take] = field(default_factory=list)


def _band_limit(samples: np.ndarray) -> np.ndarray:
    sos = butter(8, BANDWIDTH_HZ, fs=RATE, output="sos")
    return sosfiltfilt(sos, samples)


def _segment(take: Take, root: float) -> np.ndarray:
    """The take at RATE, moved to `root` plus its detune, STEM_SECONDS plus margins long."""
    samples, rate = read_mono(take.source.path)
    needed = STEM_SECONDS + 2 * MARGIN_SECONDS
    semitones = root + take.detune_cents / 100.0 - take.note.midi
    # Past the PSOLA limit the rest is a resample, which changes the duration.
    rest = semitones - float(np.clip(semitones, -PSOLA_LIMIT, PSOLA_LIMIT))
    length = needed * 2.0 ** (rest / 12.0)
    centre = 0.5 * (take.note.start + take.note.end)
    start = max(take.note.start, centre - 0.5 * length) - MARGIN_SECONDS
    raw = samples[int(start * rate) : int((start + length + 2 * MARGIN_SECONDS) * rate)]
    at_rate = resample(raw, rate / RATE)
    moved = shift(at_rate, RATE, semitones)
    margin = int(MARGIN_SECONDS * RATE)
    body = moved[margin : margin + int(STEM_SECONDS * RATE)]
    if len(body) < int(STEM_SECONDS * RATE):
        raise ValueError(f"{take.source.member}: held note too short for the stem")
    return body


def _level(samples: np.ndarray) -> np.ndarray:
    return samples * (TARGET_RMS / (np.sqrt(np.mean(samples**2)) + 1e-12))


def render_stem(takes: list[Take], root: float) -> Stem:
    """Sums the takes (each levelled, delayed and detuned), then trims and loops."""
    length = int(STEM_SECONDS * RATE)
    mix = np.zeros(length)
    for take in takes:
        body = _level(_segment(take, root))
        delay = int(take.delay_seconds * RATE)
        mix[delay:] += body[: length - delay]
    mix = _band_limit(_level(mix))
    fade = int(FADE_IN_SECONDS * RATE)
    mix[:fade] *= np.linspace(0.0, 1.0, fade)
    period = RATE / (440.0 * 2.0 ** ((root - 69.0) / 12.0))
    loop = find_loop(mix, RATE, int(LOOP_START_SECONDS * RATE), length - int(period) - 2, period)
    return Stem(samples=bake_crossfade(mix, loop, RATE)[: loop.end], loop=loop, root=root, takes=list(takes))
