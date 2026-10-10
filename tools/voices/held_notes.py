# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Finds the held notes of a long-tone recording: pitch by YIN, then the stretches
where the pitch stays within a small band long enough to loop."""
from __future__ import annotations

import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

HOP_SECONDS = 0.01
WINDOW_SECONDS = 0.04
LOWEST_HZ = 60.0
HIGHEST_HZ = 1_200.0
YIN_THRESHOLD = 0.15
VOICED_LIMIT = 0.3
# A held note: the pitch stays within this many semitones of the stretch's median.
STEADY_SEMITONES = 0.35
MIN_HELD_SECONDS = 1.3
# The first and last part of a stretch carry the onset and the release.
EDGE_SECONDS = 0.12


@dataclass(frozen=True)
class HeldNote:
    start: float
    end: float
    midi: float
    spread: float
    rms: float


def read_mono(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path)) as reader:
        rate = reader.getframerate()
        channels = reader.getnchannels()
        width = reader.getsampwidth()
        raw = reader.readframes(reader.getnframes())
    dtype = {2: np.int16, 4: np.int32}[width]
    samples = np.frombuffer(raw, dtype=dtype).astype(np.float64) / float(np.iinfo(dtype).max + 1)
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, rate


def _difference(frames: np.ndarray, window: int, max_lag: int) -> np.ndarray:
    """YIN difference function of every frame (rows), lags 0..max_lag, by FFT."""
    size = 1 << int(np.ceil(np.log2(window + max_lag)))
    spectrum = np.fft.rfft(frames, size, axis=1)
    head = np.fft.rfft(frames[:, :window], size, axis=1)
    correlation = np.fft.irfft(spectrum * np.conj(head), size, axis=1)[:, : max_lag + 1]
    squares = np.cumsum(frames**2, axis=1)
    energy_head = squares[:, window - 1]
    lags = np.arange(max_lag + 1)
    shifted = squares[:, lags + window - 1] - np.where(lags > 0, squares[:, np.maximum(lags - 1, 0)], 0.0)
    return energy_head[:, None] + shifted - 2.0 * correlation


def pitch_track(samples: np.ndarray, rate: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Frame times, midi pitch (NaN when unvoiced) and RMS of every 10 ms hop."""
    hop = int(HOP_SECONDS * rate)
    window = int(WINDOW_SECONDS * rate)
    max_lag = int(rate / LOWEST_HZ)
    min_lag = int(rate / HIGHEST_HZ)
    count = max(0, (len(samples) - window - max_lag) // hop)
    starts = np.arange(count) * hop
    frames = np.stack([samples[s : s + window + max_lag] for s in starts]) if count else np.zeros((0, window + max_lag))
    difference = _difference(frames, window, max_lag)
    lags = np.arange(1, max_lag + 1)
    normalized = difference[:, 1:] * lags / np.maximum(np.cumsum(difference[:, 1:], axis=1), 1e-12)
    normalized[:, : min_lag - 1] = np.inf
    below = normalized < YIN_THRESHOLD
    first = np.where(below.any(axis=1), below.argmax(axis=1), normalized.argmin(axis=1))
    # Walk down to the local minimum after the threshold crossing.
    rows = np.arange(count)
    for _ in range(8):
        step = np.minimum(first + 1, max_lag - 1)
        better = normalized[rows, step] < normalized[rows, first]
        first = np.where(better, step, first)
    best = normalized[rows, first]
    lag = (first + 1).astype(np.float64)
    # Parabolic refinement of the lag.
    left = normalized[rows, np.maximum(first - 1, 0)]
    right = normalized[rows, np.minimum(first + 1, max_lag - 1)]
    curvature = left - 2 * best + right
    lag += np.where(np.abs(curvature) > 1e-12, 0.5 * (left - right) / curvature, 0.0)
    midi = 69.0 + 12.0 * np.log2(rate / lag / 440.0)
    midi[best > VOICED_LIMIT] = np.nan
    rms = np.sqrt(np.mean(frames[:, :window] ** 2, axis=1)) if count else np.zeros(0)
    times = (starts + window / 2) / rate
    return times, midi, rms


def held_notes(samples: np.ndarray, rate: int) -> list[HeldNote]:
    """Stretches of steady pitch at least MIN_HELD_SECONDS long, edges trimmed."""
    times, midi, rms = pitch_track(samples, rate)
    loud = rms > max(0.01, 0.1 * float(np.max(rms, initial=0.0)))
    notes = []
    index = 0
    while index < len(midi):
        if np.isnan(midi[index]) or not loud[index]:
            index += 1
            continue
        end = index
        while end + 1 < len(midi) and loud[end + 1] and not np.isnan(midi[end + 1]) and abs(midi[end + 1] - np.nanmedian(midi[index : end + 1])) < STEADY_SEMITONES:
            end += 1
        start_time = times[index] + EDGE_SECONDS
        end_time = times[end] - EDGE_SECONDS
        if end_time - start_time >= MIN_HELD_SECONDS:
            inner = (times >= start_time) & (times <= end_time)
            notes.append(
                HeldNote(
                    start=float(start_time),
                    end=float(end_time),
                    midi=float(np.nanmedian(midi[inner])),
                    spread=float(np.nanstd(midi[inner])),
                    rms=float(np.mean(rms[inner])),
                )
            )
        index = end + 1
    return notes
