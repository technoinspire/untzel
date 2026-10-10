# noise

Filtered noise, white to wind. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
noise x~~~ ~~~~ ~~~~ ~~~~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 40..16000 Hz | 4000 | exponential |
| `resonance` | 0..1  | 0.3 | linear |
| `color` | 0..1  | 1 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `white` | Bright white noise | defaults |
| `pink` | Softer pink noise | `color 0` |
| `wind` | Resonant wind | `color 0.3`, `resonance 0.7`, `cutoff 800` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
