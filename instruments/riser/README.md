# riser

Rising sweep before a drop. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
riser x~~~ ~~~~ ~~~~ ~~~~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `length` | 0..30 s | 0 | linear |
| `cutoff` | 200..16000 Hz | 12000 | exponential |
| `resonance` | 0..1 | 0.05 | linear |
| `color` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `noise` | Noise sweeping up | defaults |
| `tone` | Rising tone | `color 1` |
| `both` | Noise and tone | `color 0.5` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
