# bass

Saw through a 2-pole low-pass filter.

Group `bass`, kind `pitched`, 2 voices per track, relative cost 1.4 per voice.

| Parameter | Range | Default | Unit | Curve |
|---|---|---|---|---|
| `cutoff` | 40..8000 | 600 | Hz | exponential |
| `decay` | 0.05..2 | 0.3 | s | exponential |
| `drive` | 0..1 | 0.1 | — | linear |

`tone` moves `cutoff` 120 → 3000. Default pattern: `c2 . . c2 . . c2 .`.

The manifest is the single source of these values; this table is copied from it.
