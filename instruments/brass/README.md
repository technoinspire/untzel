# brass

Synth brass section. Engine: virtual analog (`packages/dsp/src/engines/va/`),
8 voices, poly, kind `chord`.

```untzel
brass Cm ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 200..12000 Hz | 700 | exponential |
| `contour` | 0..1 | 0.85 | linear |
| `attack` | 0.001..2 s | 0.04 | exponential |
| `release` | 0.01..4 s | 0.2 | exponential |
| `detune` | 0..1 | 0.2 | linear |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `square` | choice |
| `mix` | 0..1 | 0.25 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.08 | exponential |
| `filter-decay` | 0.01..8 s | 0.6 | exponential |
| `drive` | 0..1 | 0.5 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0.06 | linear |
| `scoop` | 0..1 | 0.6 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `section` | Brass section with a blat and a scoop | defaults |
| `soft` | Soft, round horns | `contour 0.15`, `cutoff 1000`, `attack 0.08`, `filter lp24`, `scoop 0.1`, `drive 0`, `noise 0`, `wave2 sine`, `mix 0.4`, `filter-attack 0.3` |
| `horn` | Single bright, driven horn | `contour 0.7`, `detune 0.05`, `filter bp`, `scoop 0.8`, `drive 0.4`, `filter-attack 0.05`, `cutoff 2500` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
