# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Moves a held vowel to a zone's root pitch.

Up to PSOLA_LIMIT semitones the move is pitch-synchronous overlap-add (TD-PSOLA):
grains of two periods, cut on the glottal pulses, are laid down at the new period, so
the vowel keeps its formants and the singer keeps their natural drift and shimmer.
Past the limit the rest is a plain resample, which also moves the formants: a voice
taken far below its range sounds larger, not like a sped-up tape.
"""
from __future__ import annotations

from fractions import Fraction

import numpy as np
from scipy.signal import resample_poly

from held_notes import pitch_track

PSOLA_LIMIT = 7.0


def resample(samples: np.ndarray, ratio: float) -> np.ndarray:
    """Plays `samples` `ratio` times faster (ratio 2 = an octave up, half as long)."""
    fraction = Fraction(1.0 / ratio).limit_denominator(2_000)
    return resample_poly(samples, fraction.numerator, fraction.denominator)


def _pulse_marks(samples: np.ndarray, rate: int) -> tuple[np.ndarray, np.ndarray]:
    """Glottal pulse positions (samples) and the local period at each."""
    times, midi, _ = pitch_track(samples, rate)
    voiced = ~np.isnan(midi)
    if not voiced.any():
        raise ValueError("no pitch in the segment")
    hz = 440.0 * 2.0 ** ((np.interp(times, times[voiced], midi[voiced]) - 69.0) / 12.0)
    period_at = lambda position: float(rate / np.interp(position / rate, times, hz))  # noqa: E731
    marks = []
    first_period = period_at(0)
    position = int(np.argmax(np.abs(samples[: int(2 * first_period)])))
    while position < len(samples) - 1:
        period = period_at(position)
        marks.append((position, period))
        guess = position + period
        low = int(guess - 0.25 * period)
        high = int(guess + 0.25 * period)
        if high >= len(samples):
            break
        position = low + int(np.argmax(np.abs(samples[low:high])))
    marks_array = np.array(marks)
    return marks_array[:, 0].astype(np.int64), marks_array[:, 1]


def psola(samples: np.ndarray, rate: int, semitones: float) -> np.ndarray:
    """The same duration, `semitones` higher, formants kept."""
    if abs(semitones) < 1e-3:
        return samples.copy()
    ratio = 2.0 ** (semitones / 12.0)
    marks, periods = _pulse_marks(samples, rate)
    out = np.zeros(len(samples))
    weight = np.zeros(len(samples))
    position = float(marks[0])
    while position < len(samples):
        nearest = int(np.argmin(np.abs(marks - position)))
        centre = int(marks[nearest])
        half = int(periods[nearest])
        lo, hi = centre - half, centre + half
        if lo < 0 or hi > len(samples):
            position += periods[nearest] / ratio
            continue
        window = np.hanning(hi - lo)
        start = int(round(position)) - half
        end = start + (hi - lo)
        if start >= 0 and end <= len(samples):
            out[start:end] += samples[lo:hi] * window
            weight[start:end] += window
        position += periods[nearest] / ratio
    # Normalise the overlap so a shift down (sparser grains) keeps its level.
    return out / np.maximum(weight, 0.25)


def shift(samples: np.ndarray, rate: int, semitones: float) -> np.ndarray:
    """PSOLA for the first PSOLA_LIMIT semitones, a resample for the rest."""
    kept = float(np.clip(semitones, -PSOLA_LIMIT, PSOLA_LIMIT))
    moved = psola(samples, rate, kept)
    rest = semitones - kept
    return moved if abs(rest) < 1e-3 else resample(moved, 2.0 ** (rest / 12.0))
