# hat

Noise and inharmonic squares through a high-pass filter.

Group `drums`, kind `drum`, 4 voices per track, relative cost 0.6 per voice.

| Parameter | Range | Default | Unit | Curve |
|---|---|---|---|---|
| `open` | 0..1 | 0 | — | linear |
| `decay` | 0.01..0.5 | 0.06 | s | exponential |
| `color` | 0..1 | 0.5 | — | linear |
| `band` | 0..1 | 0 | — | linear |

`tone` moves `open` 0 → 1. `band` crossfades the high-pass into a band-pass, from the
open hiss (0) to a thin, boxed hat (1). Patterns: the manifest's `patterns`.

The manifest is the single source of these values; this table is copied from it.
