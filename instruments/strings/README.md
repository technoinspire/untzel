# strings

String ensemble. Engine: virtual analog (`packages/dsp/src/engines/va/`),
8 voices, poly, kind `chord`.

```untzel
strings Cm ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.7 | linear |
| `attack` | 0.01..8 s | 0.35 | exponential |
| `release` | 0.01..8 s | 0.8 | exponential |
| `detune` | 0..1 | 0.35 | linear |
| `width` | 0..1 | 0.5 | linear |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `filter-decay` | 0.01..8 s | 4 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0.3 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |
| `vibrato` | 0..1 | 0.6 | linear |
| `ensemble` | 0..1 | 0.8 | linear |
| `body` | 0..1 | 0.8 | linear |
| `level` | 0.05..8 | 1 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `ensemble` | Full section in an ensemble, with vibrato | defaults |
| `slow` | Slow, dark swell | `attack 1.5`, `release 2`, `brightness 0.45`, `ensemble 1`, `body 0.3`, `vibrato 0` |
| `tremolo` | Bowed tremolo, woody | `width 0.05`, `attack 0.05`, `ensemble 0.3`, `body 0.9`, `vibrato 0`, `level 1.5` |
| `high` | High and thin | `brightness 0.3`, `detune 0.2`, `filter hp`, `ensemble 0.6`, `body 0` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
