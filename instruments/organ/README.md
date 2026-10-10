# organ

Drawbar organ. Engine: additive (`packages/dsp/src/engines/additive.rs`),
12 voices, poly, kind `chord`.

```untzel
organ Cm ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `low` | 0..1  | 0.8 | linear |
| `mid` | 0..1  | 0.6 | linear |
| `high` | 0..1  | 0.3 | linear |
| `percussion` | 0..1  | 0 | linear |
| `attack` | 0.001..2 s | 0.005 | exponential |
| `release` | 0.01..4 s | 0.08 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `full` | Full drawbars | defaults |
| `soft` | Soft flutes | `high 0.05`, `mid 0.4` |
| `perc` | Percussive click | `percussion 0.8`, `high 0.1` |
| `church` | Big and slow | `low 1`, `mid 0.9`, `high 0.8`, `attack 0.08`, `release 0.8` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
