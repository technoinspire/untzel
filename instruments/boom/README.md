# boom

Long booming tuned kick bass. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
1 voice, mono, kind `pitched`.

```untzel
boom c1 ~ ~ . . . c1 . / . . eb1 ~ ~ ~ . .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.1..8 s | 1.2 | exponential |
| `tune` | 0..1 | 0.5 | linear |
| `bend` | 0..1 | 0.3 | linear |
| `color` | 0..1 | 0.45 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `long` | Long sustained boom with some grit | defaults |
| `short` | Punchy and short | `decay 0.4` |
| `dirty` | Saturated hard, a deeper drop | `color 0.7`, `bend 0.6` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
