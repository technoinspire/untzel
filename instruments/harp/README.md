# harp

Harp, two strings per note. Engine: plucked string (`packages/dsp/src/engines/string.rs`),
12 voices, poly, kind `chord`.

```untzel
harp c3 g3 eb4 g3
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.5 | linear |
| `decay` | 0.1..20 s | 4 | exponential |
| `position` | 0..1 | 0.4 | linear |
| `detune` | 0..1 | 0.3 | linear |
| `release` | 0.01..4 s | 0.6 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `concert` | Concert harp | defaults |
| `soft` | Soft and dark, plucked near the middle, shorter | `brightness 0.45`, `position 0.6`, `decay 1.8` |
| `glass` | Glassy shimmer | `brightness 0.9`, `detune 0.6` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
