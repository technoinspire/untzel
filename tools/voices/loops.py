# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Loop points of a sustained vowel and the crossfade baked into the samples.

The loop ends near the end of the stem and starts after the attack. The end is
searched within one period before its target for the waveform that best matches the
one before the start target; then each point moves, on its own, to its nearest rising
zero crossing (each within half a period), so the matched offset is not kept exactly.
The baked crossfade, and the 4 ms one the engine adds at run time, cover that shift:
the last CROSSFADE_SECONDS before the loop end are blended, equal power, with the
samples before the loop start, so the jump from the end back to the start continues
the same waveform.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

CROSSFADE_SECONDS = 0.12
MATCH_SECONDS = 0.02


@dataclass(frozen=True)
class Loop:
    start: int
    end: int


def _rising_zero_near(samples: np.ndarray, index: int, reach: int) -> int:
    low = max(1, index - reach)
    high = min(len(samples) - 1, index + reach)
    candidates = np.nonzero((samples[low - 1 : high - 1] < 0) & (samples[low:high] >= 0))[0] + low
    if len(candidates) == 0:
        return index
    return int(candidates[np.argmin(np.abs(candidates - index))])


def find_loop(samples: np.ndarray, rate: int, start_target: int, end_target: int, period: float) -> Loop:
    """Loop points near the targets whose preceding waveforms match best."""
    span = int(MATCH_SECONDS * rate)
    reach = max(2, int(period))
    reference = samples[start_target - span : start_target]
    best_end, best_score = end_target, -np.inf
    for end in range(end_target - reach, end_target + 1):
        candidate = samples[end - span : end]
        score = float(np.dot(reference, candidate) / (np.linalg.norm(reference) * np.linalg.norm(candidate) + 1e-12))
        if score > best_score:
            best_end, best_score = end, score
    start = _rising_zero_near(samples, start_target, reach // 2)
    end = _rising_zero_near(samples, best_end, reach // 2)
    # Each point snaps on its own; the crossfades absorb what the snap moves.
    return Loop(start=start, end=min(end, len(samples)))


def bake_crossfade(samples: np.ndarray, loop: Loop, rate: int) -> np.ndarray:
    """A copy whose last crossfade before `loop.end` fades into the audio before `loop.start`."""
    length = min(int(CROSSFADE_SECONDS * rate), loop.start, loop.end - loop.start)
    out = samples.copy()
    phase = np.linspace(0.0, 1.0, length, endpoint=False) * (np.pi / 2)
    tail = slice(loop.end - length, loop.end)
    lead = slice(loop.start - length, loop.start)
    out[tail] = samples[tail] * np.cos(phase) + samples[lead] * np.sin(phase)
    return out
