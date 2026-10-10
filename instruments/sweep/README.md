# sweep

Filter sweep, up, down or notch. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
sweep x~~~ ~~~~ ~~~~ ~~~~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `length` | 0..30 s | 0 | linear |
| `cutoff` | 200..16000 Hz | 6000 | exponential |
| `resonance` | 0..1 | 0.97 | linear |
| `bend` | 0..1 | 0 | linear |
| `color` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `up` | Band sweeping up | defaults |
| `down` | Band sweeping down | `bend 1` |
| `notch` | Notch sweeping up | `color 1` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
