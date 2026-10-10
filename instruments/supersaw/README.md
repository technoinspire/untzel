# supersaw

Seven detuned saws. Engine: virtual analog (`packages/dsp/src/engines/va/`),
8 voices, poly, kind `chord`.

```untzel
supersaw Cm ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 200..16000 Hz | 5000 | exponential |
| `detune` | 0..1 | 0.6 | linear |
| `attack` | 0.001..4 s | 0.01 | exponential |
| `release` | 0.01..4 s | 0.4 | exponential |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `filter-decay` | 0.01..8 s | 1 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0.8 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |
| `low-cut` | 0..1 | 0.2 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `anthem` | Big, wide anthem lead | defaults |
| `thin` | Narrow and focused | `detune 0.2`, `cutoff 3000`, `spread 0.2`, `low-cut 0` |
| `wide` | Very wide, bright and buzzing | `detune 0.85`, `spread 1`, `low-cut 1`, `wave2 square`, `mix 0.4`, `cutoff 10000` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
