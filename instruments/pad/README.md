# pad

Warm analog pad. Engine: virtual analog (`packages/dsp/src/engines/va/`),
8 voices, poly, kind `chord`.

```untzel
pad Cm7 ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.47 | linear |
| `attack` | 0.01..8 s | 0.8 | exponential |
| `release` | 0.01..8 s | 1.8 | exponential |
| `detune` | 0..1 | 0.35 | linear |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `triangle` | choice |
| `mix` | 0..1 | 0.5 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 1.5 | exponential |
| `filter-decay` | 0.01..8 s | 4 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0.7 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |
| `resonance` | 0..0.95 | 0.15 | linear |
| `contour` | 0..1 | 0.3 | linear |
| `decay` | 0.05..8 s | 2 | exponential |
| `sustain` | 0..1 | 0.85 | linear |
| `level` | 0.05..8 | 1 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `warm` | Warm, soft and wide, opening slowly | defaults |
| `dark` | Dark, round and close | `brightness 0.25`, `wave2 sine`, `mix 0.7`, `spread 0.3`, `filter lp24` |
| `bright` | Open saws, wide and airy | `brightness 0.85`, `filter lp12`, `mix 0`, `spread 1`, `drive 0.2` |
| `sea` | Slow, wide and hollow | `attack 2.5`, `release 4`, `detune 0.6`, `filter bp`, `brightness 0.45`, `spread 1`, `filter-attack 3` |
| `noir` | Melodic techno: resonant saws that open slowly | `wave2 saw`, `mix 0.5`, `filter lp24`, `brightness 0.4`, `resonance 0.45`, `contour 0.5`, `filter-attack 1.5`, `filter-decay 3`, `spread 0.6`, `drive 0.15` |
| `hypnotic` | Melodic techno: synced, pulsing chord pad | `wave2 square`, `mix 0.5`, `sync 0.35`, `filter lp24`, `brightness 0.45`, `resonance 0.6`, `contour 0.55`, `filter-attack 0.01`, `filter-decay 1.2`, `decay 1.5`, `sustain 0.6`, `spread 0.8`, `attack 0.05` |
| `dusk` | Afro house: soft warm triangle chords | `wave2 triangle`, `mix 0.6`, `filter lp12`, `brightness 0.5`, `resonance 0.1`, `contour 0.15`, `spread 0.5`, `detune 0.25`, `attack 0.4` |
| `void` | Psytrance: band-passed, resonant, slowly moving air | `filter bp`, `brightness 0.55`, `resonance 0.6`, `wave2 square`, `mix 0.4`, `sync 0.4`, `attack 2`, `release 3`, `spread 1`, `noise 0.08`, `contour 0.6`, `filter-attack 4`, `level 0.55` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
