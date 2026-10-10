# bell

Bells, tubular to toy. Engine: FM (`packages/dsp/src/engines/fm.rs`),
8 voices, poly, kind `chord`.

```untzel
bell c4 ~ ~ ~ g4 ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1  | 0.5 | linear |
| `feedback` | 0..1  | 0.1 | linear |
| `decay` | 0.1..8 s | 3 | exponential |
| `release` | 0.01..8 s | 1.5 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `tubular` | Tubular bell | defaults |
| `glass` | Glass chime | `brightness 0.8`, `decay 2` |
| `toy` | Toy piano bell | `brightness 0.3`, `decay 0.6` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
