# fm-lead

FM lead, bright to flute. Engine: FM (`packages/dsp/src/engines/fm.rs`),
1 voice, mono, kind `pitched`.

```untzel
fm-lead c4 ~ eb4 . g4 ~ ~ .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1  | 0.5 | linear |
| `feedback` | 0..1  | 0.2 | linear |
| `attack` | 0.001..2 s | 0.01 | exponential |
| `release` | 0.01..4 s | 0.25 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `bright` | Bright digital lead | defaults |
| `brass` | Brassy | `brightness 0.7`, `attack 0.05` |
| `flute` | Breathy flute | `brightness 0.15`, `feedback 0`, `attack 0.08` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
