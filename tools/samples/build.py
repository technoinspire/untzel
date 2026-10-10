# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""Builds the recorded packs: downloads the takes listed in sources.py, cuts
each one at its onset, levels it, loops the sustained ones and lets the one-shots ring
out into a silent loop, then writes `instruments/<name>/samples/v1/pack.{json,opus}`.

usage: python3 tools/samples/build.py [instrument ...]   (all by default)
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "voices"))
from loops import Loop, bake_crossfade, find_loop  # noqa: E402

from sources import PACKS, Pack, Take, _midi  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / ".cache" / "samples-src"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
RATE = 48_000
GAP = 1_024
SILENT_TAIL = 2_400
SILENT_LOOP = 2_048
PEAK = 0.89
#: Layers are levelled to equal loudness: the loud layer differs by its brighter attack, as
#: a mixed sample library does; velocity still scales the level.
SOFT_LAYER_DB = 0.0
#: Transients are held to this many dB over the head RMS, so a struck note sits in the mix
#: at the same level as a synthesised one instead of spiking.
MAX_CREST_DB = 14.0
SUSTAIN_LOOP = (1.1, 2.8)


def fetch(take: Take) -> Path:
    name = hashlib.sha1(take.url.encode()).hexdigest()[:16] + Path(take.url).suffix
    path = CACHE / name
    if not path.exists():
        CACHE.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(take.url, timeout=120) as response:
            data = response.read()
        path.write_bytes(data)
    return path


def highpass(samples: np.ndarray, hz: float) -> np.ndarray:
    """Two RBJ 2nd-order Butterworth high-pass sections (24 dB/octave) at `hz`."""
    if hz <= 0:
        return samples
    w = 2 * np.pi * hz / RATE
    alpha = np.sin(w) / (2 * np.sqrt(0.5))
    cos = np.cos(w)
    b = np.array([(1 + cos) / 2, -(1 + cos), (1 + cos) / 2])
    a = np.array([1 + alpha, -2 * cos, 1 - alpha])
    b, a = b / a[0], a / a[0]
    out = samples.astype(np.float64)
    for _ in range(2):
        y = np.zeros_like(out)
        x1 = x2 = y1 = y2 = 0.0
        for n, x in enumerate(out):
            v = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
            x2, x1, y2, y1 = x1, x, y1, v
            y[n] = v
        out = y
    return out
def decode(path: Path) -> np.ndarray:
    raw = subprocess.run([FFMPEG, "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(RATE), "-f", "f32le", "-"],
                         check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype="<f4").astype(np.float64)


def onset(samples: np.ndarray) -> int:
    peak = float(np.max(np.abs(samples))) or 1.0
    above = np.nonzero(np.abs(samples) > 0.02 * peak)[0]
    first = int(above[0]) if len(above) else 0
    return max(0, first - int(0.004 * RATE))


def seconds_for(pack: Pack, midi: int) -> float:
    low, high = pack.seconds
    t = min(1.0, max(0.0, (midi - 21) / 87))
    return low + (high - low) * t


def cut(pack: Pack, take: Take, samples: np.ndarray) -> tuple[np.ndarray, Loop]:
    start = onset(samples)
    midi = _midi(take.named)
    if pack.kind == "sustain":
        stem = samples[start:start + int(3.0 * RATE)]
        period = RATE / (440.0 * 2 ** ((midi - 69) / 12))
        loop = find_loop(stem, RATE, int(SUSTAIN_LOOP[0] * RATE), min(len(stem) - 1, int(SUSTAIN_LOOP[1] * RATE)), period)
        stem = bake_crossfade(stem[:loop.end], loop, RATE)
        return stem, loop
    length = int(seconds_for(pack, midi) * RATE)
    stem = samples[start:start + length].copy()
    fade = min(len(stem), max(int(0.1 * RATE), len(stem) // 6))
    stem[-fade:] *= np.cos(np.linspace(0, np.pi / 2, fade)) ** 2
    stem = np.concatenate([stem, np.zeros(SILENT_TAIL)])
    return stem, Loop(start=len(stem) - SILENT_LOOP, end=len(stem))


#: Per-layer trims (dB) where one layer reads louder than the others (strings tremolo).
LAYER_DB = {("strings", 1.0): -2.0}


def level(stem: np.ndarray, position: float, layered: bool, instrument: str = "") -> np.ndarray:
    """Equal loudness over the first half second; the soft layer sits SOFT_LAYER_DB under."""
    head = stem[: int(0.5 * RATE)]
    rms = float(np.sqrt(np.mean(head ** 2))) or 1.0
    gain = 0.1 / rms
    if layered and position == 0.0:
        gain *= 10 ** (SOFT_LAYER_DB / 20)
    gain *= 10 ** (LAYER_DB.get((instrument, position), 0.0) / 20)
    return limit(stem * gain, 0.1 * 10 ** (MAX_CREST_DB / 20))


def limit(stem: np.ndarray, ceiling: float) -> np.ndarray:
    """Peak limiter: instant attack (a 2 ms lookahead), 60 ms release."""
    look = int(0.002 * RATE)
    level = np.abs(np.concatenate([stem[look:], np.zeros(look)]))
    level = np.maximum(level, np.abs(stem))
    release = np.exp(-1.0 / (0.06 * RATE))
    envelope = np.empty_like(level)
    current = 0.0
    for i, x in enumerate(level):
        current = x if x > current else current * release + x * (1 - release)
        envelope[i] = current
    gain = np.minimum(1.0, ceiling / np.maximum(envelope, 1e-9))
    return stem * gain


def zones_of(takes: list[Take]) -> list[tuple[float, float]]:
    """Each take's [lowest, highest) on its own layer: boundaries half-way between roots."""
    midis = [_midi(t.named) for t in takes]
    bounds = []
    for i, m in enumerate(midis):
        low = 0.0 if i == 0 else (midis[i - 1] + m) / 2
        high = 128.0 if i == len(midis) - 1 else (m + midis[i + 1]) / 2
        bounds.append((low, high))
    return bounds


def build(pack: Pack) -> dict:
    with ThreadPoolExecutor(8) as pool:
        paths = list(pool.map(fetch, pack.takes))
    positions = sorted({t.position for t in pack.takes})
    layered = len(positions) > 1 and pack.instrument in ("piano", "strings")
    stems: dict[Take, tuple[np.ndarray, Loop]] = {}
    for take, path in zip(pack.takes, paths):
        stem, loop = cut(pack, take, highpass(decode(path), pack.highpass_hz))
        stems[take] = (level(stem, take.position, layered, pack.instrument), loop)
    pieces, zones, cursor = [], [], 0
    for position in positions:
        takes = sorted((t for t in pack.takes if t.position == position), key=lambda t: _midi(t.named))
        for take, (low, high) in zip(takes, zones_of(takes)):
            stem, loop = stems[take]
            pieces.append(np.zeros(GAP))
            cursor += GAP
            zones.append({"take": take.url.rsplit("/", 1)[-1], "position": position, "root": float(_midi(take.named)),
                          "lowest": low, "highest": high, "pan": take.pan, "start": cursor,
                          "loopStart": cursor + loop.start, "loopEnd": cursor + loop.end})
            pieces.append(stem)
            cursor += len(stem)
    pieces.append(np.zeros(GAP))
    audio = np.concatenate(pieces)
    audio *= PEAK / max(1e-9, float(np.max(np.abs(audio))))
    out = ROOT / "instruments" / pack.instrument / "samples" / "v1"
    out.mkdir(parents=True, exist_ok=True)
    wav = CACHE / f"{pack.instrument}.wav"
    pcm = (np.clip(audio, -1, 1) * 32767).round().astype("<i2")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1", "-i", "-", str(wav)],
                   input=pcm.tobytes(), check=True)
    opus = out / "pack.opus"
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", str(wav), "-c:a", "libopus", "-b:a", pack.bitrate, "-vbr", "on",
                    "-compression_level", "10", "-application", "audio", "-frame_duration", "20", "-map_metadata", "-1",
                    "-fflags", "+bitexact", "-flags:a", "+bitexact", str(opus)], check=True)
    decoded = len(subprocess.run([FFMPEG, "-v", "error", "-i", str(opus), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
                                 check=True, capture_output=True).stdout) // 2
    if decoded != len(audio):
        raise RuntimeError(f"{pack.instrument}: encoded {len(audio)} frames, decodes {decoded}")
    data = opus.read_bytes()
    manifest = {
        "format": 1, "instrument": pack.instrument, "version": 1, "sampleRate": RATE, "frames": len(audio),
        "audio": {"file": "pack.opus", "codec": "opus", "bitrate": pack.bitrate, "bytes": len(data),
                  "sha256": hashlib.sha256(data).hexdigest()},
        "license": {**pack.license, "changes": "Cut at the onset, mixed to mono, resampled to 48 kHz, levelled, looped "
                    "(sustained notes) or faded into silence (one-shots) and encoded as Opus (tools/samples/build.py)."},
        "source": {**pack.source, "files": sorted({t.url for t in pack.takes}), "notes": pack.notes},
        "zones": zones,
    }
    (out / "pack.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest


if __name__ == "__main__":
    for name in sys.argv[1:] or list(PACKS):
        manifest = build(PACKS[name])
        print(f"{name}: {len(manifest['zones'])} zones, {manifest['frames'] / RATE:.1f} s, {manifest['audio']['bytes'] / 1e6:.2f} MB")
