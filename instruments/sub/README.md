# sub

Pure low sub bass. Engine: virtual analog (`packages/dsp/src/engines/va/`),
1 voice, mono, kind `pitched`.

```untzel
sub c1 . . c1 . . c1 .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `wave` | `triangle`, `sine` | `sine` | choice |
| `attack` | 0.001..1 s | 0.004 | exponential |
| `release` | 0.01..2 s | 0.12 | exponential |
| `cutoff` | 40..2000 Hz | 400 | exponential |
| `drive` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `pure` | Clean sine | defaults |
| `warm` | Triangle with a little edge | `wave triangle`, `cutoff 600` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
