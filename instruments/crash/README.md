# crash

Crash cymbal. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
crash x... .... .... ....
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.2..8 s | 1.8 | exponential |
| `color` | 0..1  | 0.5 | linear |
| `size` | 0..1  | 0.6 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `wide` | Big open crash | defaults |
| `short` | Choked crash | `decay 0.6`, `size 0.4` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
