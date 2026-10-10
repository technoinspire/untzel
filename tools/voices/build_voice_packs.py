#!/usr/bin/env python3
# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Builds the `vox` and `choir` sample packs from VocalSet.

Usage: python3 tools/voices/build_voice_packs.py

1. Checks on Zenodo that VocalSet (record 1442513) is CC BY 4.0; stops otherwise.
   Records the record's version and the archive read (`VocalSet11.zip`) in every pack.json.
2. Downloads the straight long tones on a, i and u into `.cache/voices/` (never
   committed), by range requests into the 2 GB archive, CRC-checked.
3. Finds the held notes, plans each zone, renders and loops the stems.
4. Writes `instruments/<name>/samples/v1/pack.opus` and `pack.json`, and prints the
   size of each pack against the 1.5 MB budget.

Needs Python 3.11+, numpy, scipy and ffmpeg with libopus at /opt/homebrew/bin/ffmpeg.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from assemble import assemble  # noqa: E402
from held_notes import held_notes, read_mono  # noqa: E402
from plans import Candidate, choir_plan, vox_plan  # noqa: E402
from stems import render_stem  # noqa: E402
from vocalset import fetch_long_tones, fetch_record, provenance, verify_license  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "voices"
PACK_BUDGET_BYTES = 1_500_000
PLANS = {"vox": vox_plan, "choir": choir_plan}


def candidates(sources) -> list[Candidate]:
    found = []
    for source in sources:
        samples, rate = read_mono(source.path)
        found.extend(Candidate(source, note) for note in held_notes(samples, rate))
    return found


def main() -> int:
    record = fetch_record()
    license_id = verify_license(record)
    origin = provenance(record)
    print(f"VocalSet record license: {license_id}, version {origin['recordVersion']}, archive {origin['archive']}")
    sources = fetch_long_tones(CACHE)
    pool = candidates(sources)
    print(f"{len(sources)} long tones, {len(pool)} held notes")
    over = False
    for name, plan_of in PLANS.items():
        plans = plan_of(pool)
        stems = [render_stem(list(plan.takes), plan.root) for plan in plans]
        manifest = assemble(name, plans, stems, sources, origin, ROOT / "instruments" / name / "samples" / "v1", CACHE / "work")
        size = manifest["audio"]["bytes"]
        seconds = manifest["frames"] / manifest["sampleRate"]
        verdict = "PASS" if size <= PACK_BUDGET_BYTES else "FAIL"
        over = over or size > PACK_BUDGET_BYTES
        print(f"{name}: {len(plans)} zones, {seconds:.1f} s, {size} bytes of {PACK_BUDGET_BYTES} ({verdict})")
    return 1 if over else 0


if __name__ == "__main__":
    sys.exit(main())
