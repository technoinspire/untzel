# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Which recordings make each zone of the two packs.

- `vox`: one solo singer per register, a zone every 3 semitones. The baritone `m6`
  sings up to G4 and the mezzo-soprano `f8` from A4.
- `choir`: an ensemble per zone, a zone every 4 semitones: the 4 to 6 singers whose
  held note is nearest the root, split in two stems (left and right of the stereo
  spread), each singer with a small onset delay and detune. At the low end fewer
  singers reach: the zone takes the 4 nearest within 13 semitones, and no fewer than
  3. In the v1 packs the three aah zones below c3 (roots 36, 40, 44) have 3 singers,
  because only three hold an aah that low; every other zone has 4 to 6.
"""
from __future__ import annotations

from dataclasses import dataclass

from held_notes import HeldNote
from stems import Take
from vocalset import SourceFile

VOWELS = {"aah": ("a", 0.0), "ooh": ("u", 1.0)}
VOX_ROOTS = list(range(36, 79, 3))
CHOIR_ROOTS = list(range(36, 85, 4))
VOX_LOW_SINGER = "m6"
VOX_HIGH_SINGER = "f8"
VOX_SPLIT = 67.5
CHOIR_MAX_SINGERS = 6
CHOIR_MIN_SINGERS = 4
CHOIR_FLOOR_SINGERS = 3
CHOIR_NEAR_SEMITONES = 7.5
CHOIR_FAR_SEMITONES = 13.0
CHOIR_PAN = 0.55
# Onset delay (ms) and detune (cents) of the n-th singer of a zone.
CHOIR_DELAYS_MS = [0.0, 11.0, 23.0, 7.0, 31.0, 17.0]
CHOIR_DETUNE_CENTS = [-5.0, 6.0, -2.0, 4.0, -7.0, 3.0]


@dataclass(frozen=True)
class Candidate:
    source: SourceFile
    note: HeldNote


@dataclass(frozen=True)
class ZonePlan:
    vowel: str
    position: float
    root: float
    lowest: float
    highest: float
    pan: float
    takes: tuple[Take, ...]


def _bounds(roots: list[int]) -> list[tuple[float, float]]:
    """Each root owns the notes up to half way to its neighbours; the ends reach 0 and 127."""
    bounds = []
    for index, root in enumerate(roots):
        lowest = 0.0 if index == 0 else 0.5 * (roots[index - 1] + root)
        highest = 127.0 if index == len(roots) - 1 else 0.5 * (root + roots[index + 1])
        bounds.append((lowest, highest))
    return bounds


def _nearest(candidates: list[Candidate], root: float) -> Candidate:
    return min(candidates, key=lambda candidate: abs(candidate.note.midi - root))


def vox_plan(candidates: list[Candidate]) -> list[ZonePlan]:
    zones = []
    for vowel, (letter, position) in VOWELS.items():
        for root, (lowest, highest) in zip(VOX_ROOTS, _bounds(VOX_ROOTS)):
            singer = VOX_LOW_SINGER if root < VOX_SPLIT else VOX_HIGH_SINGER
            own = [c for c in candidates if c.source.singer == singer and c.source.vowel == letter]
            if not own:
                raise ValueError(f"vox: {singer} has no held {vowel}")
            chosen = _nearest(own, root)
            zones.append(ZonePlan(vowel, position, float(root), lowest, highest, 0.0, (Take(chosen.source, chosen.note),)))
    return zones


def _ensemble(candidates: list[Candidate], root: float) -> list[Candidate]:
    """The nearest held note of each singer, closest singers first."""
    best: dict[str, Candidate] = {}
    for candidate in candidates:
        current = best.get(candidate.source.singer)
        if current is None or abs(candidate.note.midi - root) < abs(current.note.midi - root):
            best[candidate.source.singer] = candidate
    ranked = sorted(best.values(), key=lambda candidate: (abs(candidate.note.midi - root), candidate.source.singer))
    near = [candidate for candidate in ranked if abs(candidate.note.midi - root) <= CHOIR_NEAR_SEMITONES]
    # At the ends of the range fewer singers are near: reach further, never past an octave and a bit.
    reachable = [candidate for candidate in ranked if abs(candidate.note.midi - root) <= CHOIR_FAR_SEMITONES]
    chosen = near if len(near) >= CHOIR_MIN_SINGERS else reachable[:CHOIR_MIN_SINGERS]
    if len(chosen) < CHOIR_FLOOR_SINGERS:
        raise ValueError(f"choir: fewer than {CHOIR_FLOOR_SINGERS} singers near {root}")
    return chosen[:CHOIR_MAX_SINGERS]


def choir_plan(candidates: list[Candidate]) -> list[ZonePlan]:
    zones = []
    for vowel, (letter, position) in VOWELS.items():
        own = [c for c in candidates if c.source.vowel == letter]
        for root, (lowest, highest) in zip(CHOIR_ROOTS, _bounds(CHOIR_ROOTS)):
            singers = _ensemble(own, root)
            takes = [
                Take(c.source, c.note, CHOIR_DELAYS_MS[i] / 1000.0, CHOIR_DETUNE_CENTS[i])
                for i, c in enumerate(singers)
            ]
            for side, pan in enumerate((-CHOIR_PAN, CHOIR_PAN)):
                zones.append(ZonePlan(vowel, position, float(root), lowest, highest, pan, tuple(takes[side::2])))
    return zones
