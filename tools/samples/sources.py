# SPDX-License-Identifier: CPAL-1.0
# Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
"""The recorded instruments Untzel plays: real recordings instead of synthesised voices.
One `Pack` per instrument: which files, where each one sits on the timbre axis
(`position`, 0..1: a velocity layer or a sound of the instrument) and how it is cut.
Every source is CC0 or CC BY and allows commercial use."""
from __future__ import annotations

from dataclasses import dataclass, field
from urllib.parse import quote

SALAMANDER = "https://raw.githubusercontent.com/sfzinstruments/SalamanderGrandPiano/master/Samples/"
VSCO = "https://raw.githubusercontent.com/sgossner/VSCO-2-CE/master/"
VCSL = "https://raw.githubusercontent.com/sgossner/VCSL/master/"


@dataclass(frozen=True)
class Take:
    url: str
    #: The note the file is named after; the root is measured and snapped near it.
    named: str
    position: float
    pan: float = 0.0


@dataclass(frozen=True)
class Pack:
    instrument: str
    #: "oneshot": plays to its natural end then silence; "sustain": loops the held tone.
    kind: str
    takes: tuple[Take, ...]
    license: dict
    source: dict
    #: Seconds kept per take, at midi 21 and at midi 108 (linear between).
    seconds: tuple[float, float] = (2.0, 2.0)
    #: Whether the root is measured (pitched, steady) or taken from the name (bells, mallets).
    measure: bool = True
    bitrate: str = "64k"
    #: Cutoff of a 4th-order high-pass on every take, Hz (0 = none): the room rumble and the
    #: handling noise of the percussion recordings, which sat in the kick's and bass's octaves.
    highpass_hz: float = 0.0
    notes: list[str] = field(default_factory=list)


CC0 = {"id": "CC0-1.0", "name": "Creative Commons Zero 1.0 Universal", "url": "https://creativecommons.org/publicdomain/zero/1.0/"}
CC_BY_3 = {"id": "CC-BY-3.0", "name": "Creative Commons Attribution 3.0 Unported", "url": "https://creativecommons.org/licenses/by/3.0/"}
VSCO_SOURCE = {"dataset": "VSCO 2 Community Edition", "author": "Versilian Studios LLC", "record": "https://github.com/sgossner/VSCO-2-CE"}
VCSL_SOURCE = {"dataset": "Versilian Community Sample Library", "author": "Versilian Studios LLC", "record": "https://github.com/sgossner/VCSL"}


def _vsco(path: str) -> str:
    return VSCO + quote(path)


def _vcsl(path: str) -> str:
    return VCSL + quote(path)


SALAMANDER_ROOTS = ["A0", "C1", "D#1", "F#1", "A1", "C2", "D#2", "F#2", "A2", "C3", "D#3", "F#3", "A3", "C4", "D#4", "F#4",
                    "A4", "C5", "D#5", "F#5", "A5", "C6", "D#6", "F#6", "A6", "C7", "D#7", "F#7", "A7", "C8"]


def _midi(name: str) -> int:
    letters = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    pitch = letters[name[0]]
    rest = name[1:]
    if rest.startswith("#"):
        pitch, rest = pitch + 1, rest[1:]
    elif rest.startswith("b"):
        pitch, rest = pitch - 1, rest[1:]
    return 12 * (int(rest) + 1) + pitch


def _pan_by_pitch(name: str, width: float = 0.5) -> float:
    """A player's view of a keyboard: low notes left, high notes right."""
    return round(max(-1.0, min(1.0, (_midi(name) - 64) / 44 * width)), 3)


PIANO = Pack(
    instrument="piano",
    kind="oneshot",
    takes=tuple(
        Take(SALAMANDER + quote(f"{root}v{layer}.flac"), root, position, _pan_by_pitch(root))
        for root in SALAMANDER_ROOTS
        for layer, position in ((6, 0.0), (14, 1.0))
    ),
    license=CC_BY_3,
    source={"dataset": "Salamander Grand Piano V3", "author": "Alexander Holm", "instrument": "Yamaha C5",
            "record": "https://github.com/sfzinstruments/SalamanderGrandPiano"},
    # 3.4 s low to 1.8 s high keeps the 60 takes under the 1.5 MB pack budget:
    # 6.0..1.2 s made 2.0 MB and failed the build. The envelope silences a low
    # note by ~3.1 s even at `decay 12`, while a high one rings past 1.9 s, so the cut comes
    # from the bass end; 4.2..1.0 s fit too but shortened the top octaves by 0.3 s.
    seconds=(3.4, 1.8),
)

# One section per register: cello up to C3, viola D3..C4, violins from E4.
_VIOLINS = ["E4", "G4", "B4", "D5"]
_VIOLAS = ["D3", "F3", "A3", "C4"]
_CELLI = ["C1", "E1", "G1", "B1", "D2", "F2", "A2", "C3"]
# Bowed tremolo, one take per note (the first velocity the library has).
_CELLO_TREM = [(n, f"Strings/Cello Section/trem/trem_{n}_v{1 if n != 'C1' else 2}_1.wav") for n in _CELLI]
_VIOLA_TREM = [(n, f"Strings/Viola Section/trem/Violas_trem_{n}_v1_rr1.wav") for n in _VIOLAS]
_VIOLIN_TREM = [(n, f"Strings/Violin Section/Trem/VlnEns_Trem_{n}_v1.wav") for n in _VIOLINS]
STRINGS = Pack(
    instrument="strings",
    kind="sustain",
    takes=tuple(
        [Take(_vsco(f"Strings/Cello Section/susvib/susvib_{n}_v{v}_1.wav"), n, p, 0.35) for n in _CELLI for v, p in ((1, 0.0), (3, 0.5))]
        + [Take(_vsco(f"Strings/Viola Section/susvib/ViolaEns_susvib_{n}_v{v}_1.wav"), n, p, 0.1) for n in _VIOLAS for v, p in ((1, 0.0), (2, 0.5))]
        + [Take(_vsco(f"Strings/Violin Section/susVib/VlnEns_susVib_{n}_v{v}.wav"), n, p, -0.35) for n in _VIOLINS for v, p in ((1, 0.0), (2, 0.5))]
        + [Take(_vsco(path), n, 1.0, pan) for pan, files in ((0.35, _CELLO_TREM), (0.1, _VIOLA_TREM), (-0.35, _VIOLIN_TREM)) for n, path in files]
    ),
    license=CC0,
    source=VSCO_SOURCE,
    seconds=(3.0, 3.0),
    notes=["Cello, viola and violin sections; each register keeps the section that plays it (cello low, viola middle, violins high).",
           "position 0 = sustain soft, 0.5 = sustain loud, 1 = bowed tremolo."],
)

_HARP = ["E1", "G1", "B1", "D2", "F2", "A2", "C3", "E3", "G3", "B3", "D4", "F4", "A4", "C5", "E5", "G5", "B5", "D6", "F6", "A6", "B6", "D7", "F7"]
_HARP_DYN = {"E1": "f", "G1": "mp", "D7": "f", "F7": "f"}
HARP = Pack(
    instrument="harp",
    kind="oneshot",
    takes=tuple(Take(_vsco(f"Strings/Harp/KSHarp_{n}_{_HARP_DYN.get(n, 'mf')}.wav"), n, 0.0, _pan_by_pitch(n, 0.3)) for n in _HARP),
    license=CC0,
    source=VSCO_SOURCE,
    seconds=(5.0, 1.5),
)

_MARIMBA = ["F1", "C2", "B2", "C4", "B4", "C6"]
_VIBES = ["F2", "A2", "C3", "E3", "B3", "D4", "F4", "A4", "C5", "E5"]
MALLET = Pack(
    instrument="mallet",
    kind="oneshot",
    takes=tuple(
        [Take(_vcsl(f"Idiophones/Struck Idiophones/Marimba/Marimba_hit_Outrigger_{n}_med_01.wav"), n, 0.0, _pan_by_pitch(n, 0.3)) for n in _MARIMBA]
        + [Take(_vcsl(f"Idiophones/Struck Idiophones/Vibraphone/Hard Mallets/Vibes_hard_{n}_v3_rr1_Main.wav"), n, 1.0, _pan_by_pitch(n, 0.3)) for n in _VIBES]
    ),
    license=CC0,
    source=VCSL_SOURCE,
    seconds=(5.0, 3.5),
    notes=["position 0 = marimba (Outrigger, medium), 1 = vibraphone (hard mallets)."],
)

BELL = Pack(
    instrument="bell",
    kind="oneshot",
    takes=tuple(
        [Take(_vcsl(f"Idiophones/Struck Idiophones/Tubular Bells 2/TB_hit_{n}_v4_{r}.wav"), n, 0.0)
         for n, r in (("C4", 1), ("D4", 2), ("E4", 1), ("F4", 1), ("G4", 1), ("A4", 1), ("B4", 1), ("C5", 1), ("D5", 1), ("E5", 2), ("F5", 1))]
        + [Take(_vcsl(f"Idiophones/Struck Idiophones/Glockenspiel/glock_loud_{n}_01.wav"), n, 1.0) for n in ("G4", "C5", "G5", "C6", "G#6", "C7")]
    ),
    license=CC0,
    source=VCSL_SOURCE,
    seconds=(4.0, 2.5),
    measure=False,
    notes=["position 0 = tubular bells, 1 = glockenspiel."],
)

KALIMBA = Pack(
    instrument="kalimba",
    kind="oneshot",
    takes=tuple(
        Take(_vcsl(f"Idiophones/Plucked Idiophones/Kalimba, Tanzania/MBira3_pluck_Main_{n}_{k}_50_100_rr2.wav"), n, 0.0, _pan_by_pitch(n, 0.3))
        for n, k in (("G1", "k12"), ("G#1", "k11"), ("B1", "k13"), ("C#2", "k10"), ("D#2", "k14"), ("F2", "k9alt"), ("G2", "k15"),
                     ("A#2", "k8"), ("C#3", "k16"), ("D#3", "k7"), ("F3", "k17"), ("G3", "k6"), ("A#3", "k18"), ("C#4", "k5"),
                     ("D4", "k19"), ("D#4", "k20"), ("F4", "k21"), ("G4", "k22"), ("A#4", "k2"), ("B4", "k23"), ("C#5", "k24"),
                     ("E5", "k25"), ("F#5", "k1"), ("G#5", "k26"), ("C#6", "k27"))
    ),
    license=CC0,
    source={**VCSL_SOURCE, "instrument": "Kalimba (mbira), Tanzania"},
    seconds=(2.5, 1.5),
)

# Recorded percussion, so the templates' drums are real recordings too. Unpitched hits:
# the root is the name, never measured; `tune` moves the note around it in the voice.
_MEMBRANE = "Membranophones/Struck Membranophones/"
_IDIOPHONE = "Idiophones/Struck Idiophones/"
PERCUSSION_SOURCE = {**VCSL_SOURCE, "instrument": "VCSL percussion"}
CONGA = Pack(
    instrument="conga",
    kind="oneshot",
    takes=(
        Take(_vcsl(_MEMBRANE + "Conga/Tumba_HitN_v3_rr1_Sum.wav"), "C3", 0.0),
        Take(_vcsl(_MEMBRANE + "Conga/Conga_HitN_v2_rr1_Sum.wav"), "G3", 0.0),
        Take(_vcsl(_MEMBRANE + "Conga/Quinto_HitN_v2_rr1_Sum.wav"), "D4", 0.0),
        Take(_vcsl(_MEMBRANE + "Conga/Tumba_HitFM_v3_rr1_Sum.wav"), "C3", 1.0),
        Take(_vcsl(_MEMBRANE + "Conga/Conga_HitFM_v2_rr1_Sum.wav"), "G3", 1.0),
        Take(_vcsl(_MEMBRANE + "Conga/Quinto_HitFM1_v2_rr1_Sum.wav"), "D4", 1.0),
    ),
    highpass_hz=45, license=CC0, source=PERCUSSION_SOURCE, seconds=(2.0, 2.0), measure=False,
    notes=["C3 tumba, G3 conga, D4 quinto; position 0 = open tone, 1 = slap."],
)
BONGO = Pack(
    instrument="bongo",
    kind="oneshot",
    takes=(
        Take(_vcsl(_MEMBRANE + "Bongos/BongoL_Hit1_v2_rr1_Mid.wav"), "C4", 0.0),
        Take(_vcsl(_MEMBRANE + "Bongos/BongoH_Hit1_v2_rr1_Mid.wav"), "G4", 0.0),
        Take(_vcsl(_MEMBRANE + "Bongos/BongoL_HitMuted2_v2_rr1_Mid.wav"), "C4", 1.0),
        Take(_vcsl(_MEMBRANE + "Bongos/BongoH_HitMuted1_v2_rr1_Mid.wav"), "G4", 1.0),
    ),
    highpass_hz=90, license=CC0, source=PERCUSSION_SOURCE, seconds=(0.8, 0.8), measure=False,
    notes=["C4 low drum (hembra), G4 high drum (macho); position 0 = open, 1 = muted slap."],
)
COWBELL = Pack(
    instrument="cowbell",
    kind="oneshot",
    takes=(Take(_vcsl(_IDIOPHONE + "Cowbells/Cowbell1_Normal_v3_rr1_Mid.wav"), "C5", 0.0),),
    highpass_hz=300, license=CC0, source=PERCUSSION_SOURCE, seconds=(0.9, 0.9), measure=False,
)
WOODBLOCK = Pack(
    instrument="woodblock",
    kind="oneshot",
    takes=(
        Take(_vcsl(_IDIOPHONE + "Woodblock/wood_click_mp.wav"), "C5", 0.0),
        Take(_vcsl(_IDIOPHONE + "Woodblock/wood_click_ff.wav"), "C5", 1.0),
    ),
    highpass_hz=250, license=CC0, source=PERCUSSION_SOURCE, seconds=(0.5, 0.5), measure=False,
    notes=["position 0 = mezzo-piano stroke, 1 = fortissimo."],
)
SHAKER = Pack(
    instrument="shaker",
    kind="oneshot",
    takes=(
        Take(_vcsl(_IDIOPHONE + "Shaker, Small/Mid_ShakerLowFaster_Down_rr1.wav"), "C4", 0.0),
        Take(_vcsl(_IDIOPHONE + "Shaker, Small/Mid_ShakerHighFaster_Down_rr1.wav"), "C4", 1.0),
    ),
    highpass_hz=900, license=CC0, source=PERCUSSION_SOURCE, seconds=(0.5, 0.5), measure=False,
    notes=["position 0 = low, soft stroke; 1 = high, crisp stroke."],
)
CLAP = Pack(
    instrument="clap",
    kind="oneshot",
    takes=(
        Take(_vcsl(_IDIOPHONE + "Claps/SoloClap_vl3.wav"), "C4", 0.0),
        Take(_vcsl(_IDIOPHONE + "Claps/Clap_rr1.wav"), "C4", 1.0),
    ),
    highpass_hz=180, license=CC0, source=PERCUSSION_SOURCE, seconds=(0.9, 0.9), measure=False,
    notes=["position 0 = one pair of hands, 1 = a group clap."],
)
HAT = Pack(
    instrument="hat",
    kind="oneshot",
    takes=(
        Take(_vcsl(_IDIOPHONE + "Hi-Hat Cymbal/HiHat_HitC_v3_rr1_Mid.wav"), "C4", 0.0),
        Take(_vcsl(_IDIOPHONE + "Hi-Hat Cymbal/HiHat_HitO_rr1_Mid.wav"), "C4", 1.0),
    ),
    highpass_hz=500, license=CC0, source=PERCUSSION_SOURCE, seconds=(1.6, 1.6), measure=False,
    notes=["position 0 = closed hi-hat, 1 = open."],
)
PACKS = {pack.instrument: pack for pack in (PIANO, STRINGS, HARP, MALLET, BELL, KALIMBA, CONGA, BONGO, COWBELL, WOODBLOCK, SHAKER, CLAP, HAT)}
