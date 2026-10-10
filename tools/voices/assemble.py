# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Lays the stems of a pack end to end, encodes them as one Ogg Opus file and writes
the pack manifest: the zone table the engine reads, and where every zone came from."""
from __future__ import annotations

import hashlib
import json
import subprocess
import wave
from pathlib import Path

import numpy as np

from plans import ZonePlan
from stems import RATE, Stem
from vocalset import SourceFile

FORMAT = 1
# Silence before each stem: more than one 20 ms Opus frame, so no stem leaks into another.
GAP_FRAMES = 1_024
PEAK = 0.89
BITRATE = "64k"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
LICENSE = {
    "id": "CC-BY-4.0",
    "name": "Creative Commons Attribution 4.0 International",
    "url": "https://creativecommons.org/licenses/by/4.0/",
}
CHANGES = (
    "Held notes cut from the straight long tones, moved to each zone root by "
    "pitch-synchronous overlap-add (and resampling past 7 semitones), summed into "
    "ensembles for the choir, band-limited to 16 kHz, levelled, looped with a baked "
    "crossfade and encoded as Opus."
)


def _pcm16(samples: np.ndarray) -> bytes:
    return (np.clip(samples, -1.0, 1.0) * 32767.0).round().astype("<i2").tobytes()


def _write_wav(path: Path, samples: np.ndarray) -> None:
    with wave.open(str(path), "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(RATE)
        writer.writeframes(_pcm16(samples))


def _decoded_frames(path: Path) -> int:
    """Frames ffmpeg decodes from the Opus file: must equal what was encoded."""
    raw = subprocess.run(
        [FFMPEG, "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
        check=True,
        capture_output=True,
    ).stdout
    return len(raw) // 2


def assemble(
    name: str, plans: list[ZonePlan], stems: list[Stem], sources: list[SourceFile], origin: dict, out_dir: Path, work: Path
) -> dict:
    """Writes `pack.opus` and `pack.json` into `out_dir`; returns the manifest. `origin` is
    the record's provenance (`vocalset.provenance`): version, archive, DOI and citation."""
    pieces = []
    zones = []
    cursor = 0
    for plan, stem in zip(plans, stems):
        pieces.append(np.zeros(GAP_FRAMES))
        cursor += GAP_FRAMES
        zones.append(
            {
                "vowel": plan.vowel,
                "position": plan.position,
                "root": round(plan.root, 3),
                "lowest": plan.lowest,
                "highest": plan.highest,
                "pan": plan.pan,
                "start": cursor,
                "loopStart": cursor + stem.loop.start,
                "loopEnd": cursor + stem.loop.end,
                "singers": [
                    {
                        "singer": take.source.singer,
                        "file": take.source.member,
                        "heldMidi": round(take.note.midi, 2),
                        "delayMs": round(take.delay_seconds * 1000.0, 1),
                        "detuneCents": take.detune_cents,
                    }
                    for take in stem.takes
                ],
            }
        )
        pieces.append(stem.samples)
        cursor += len(stem.samples)
    pieces.append(np.zeros(GAP_FRAMES))
    audio = np.concatenate(pieces)
    audio *= PEAK / max(1e-9, float(np.max(np.abs(audio))))
    work.mkdir(parents=True, exist_ok=True)
    wav = work / f"{name}.wav"
    _write_wav(wav, audio)
    out_dir.mkdir(parents=True, exist_ok=True)
    opus = out_dir / "pack.opus"
    subprocess.run(
        [FFMPEG, "-v", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", BITRATE, "-vbr", "on",
         "-compression_level", "10", "-application", "audio", "-frame_duration", "20",
         "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", str(opus)],
        check=True,
    )
    decoded = _decoded_frames(opus)
    if decoded != len(audio):
        raise RuntimeError(f"{name}: encoded {len(audio)} frames, ffmpeg decodes {decoded}")
    data = opus.read_bytes()
    used = {take.source.member for stem in stems for take in stem.takes}
    manifest = {
        "format": FORMAT,
        "instrument": name,
        "version": 1,
        "sampleRate": RATE,
        "frames": len(audio),
        "audio": {"file": opus.name, "codec": "opus", "bitrate": BITRATE, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()},
        "license": {**LICENSE, "changes": CHANGES},
        "source": {
            **origin,
            "singers": "20 professional singers, anonymous in the dataset (ids f1–f9, m1–m11)",
            "files": [
                {"file": source.member, "singer": source.singer, "sha256": source.sha256}
                for source in sources
                if source.member in used
            ],
        },
        "zones": zones,
    }
    (out_dir / "pack.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest
