# shaker

Shaker and maracas. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
4 voices, poly, kind `drum`.

```untzel
shaker xxxx xxxx xxxx xxxx
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.01..0.5 s | 0.08 | exponential |
| `color` | 0..1 | 0.25 | linear |
| `spread` | 0..1 | 0.5 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `soft` | Gentle grains | defaults |
| `bright` | Crisp and airy | `color 0.9`, `decay 0.04` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
