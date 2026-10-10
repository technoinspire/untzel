# square

Square and pulse lead. Engine: virtual analog (`packages/dsp/src/engines/va/`),
1 voice, mono, kind `pitched`.

```untzel
square c4 . g4 . eb4 . g4 .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 100..12000 Hz | 3000 | exponential |
| `width` | 0..1 | 0.5 | linear |
| `attack` | 0.001..2 s | 0.005 | exponential |
| `release` | 0.01..4 s | 0.15 | exponential |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `filter-decay` | 0.01..8 s | 0.3 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `hollow` | Hollow square | defaults |
| `chip` | Bright chip tune | `cutoff 12000`, `width 0.25` |
| `pwm` | Thin pulse | `width 0.15` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
