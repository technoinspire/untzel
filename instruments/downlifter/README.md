# downlifter

Falling sweep after a peak. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
downlifter x~~~ ~~~~ ~~~~ ~~~~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `length` | 0..30 s | 0 | linear |
| `cutoff` | 200..16000 Hz | 8000 | exponential |
| `resonance` | 0..1 | 0.4 | linear |
| `color` | 0..1 | 0.5 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `noise` | Noise and a falling tone, sweeping down | defaults |
| `tone` | Falling tone | `color 1` |
| `both` | Bright noise, half tone | `color 0.6`, `cutoff 14000`, `resonance 0.1` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
