# stab

Chord stabs, classic and rave. Engine: virtual analog (`packages/dsp/src/engines/va/`),
8 voices, poly, kind `chord`.

```untzel
stab . Cm7 . . . Cm7 . .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 200..12000 Hz | 2500 | exponential |
| `decay` | 0.05..2 s | 0.25 | exponential |
| `detune` | 0..1 | 0.3 | linear |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `classic` | Classic house stab | defaults |
| `rave` | Driven rave stab, hollow and wide | `detune 0.8`, `cutoff 6000`, `wave2 square`, `mix 0.5`, `drive 0.3`, `spread 0.8` |
| `short` | Very short | `decay 0.1` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
