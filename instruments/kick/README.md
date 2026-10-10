# kick

Sine with a pitch envelope, a click, an octave overtone, grit and saturation.
Group `drums`, kind `drum`, 2 voices per track, relative cost 1 per voice.

| Parameter | Range | Default | Unit | Curve |
|---|---|---|---|---|
| `decay` | 0.05..1.5 | 0.45 | s | exponential |
| `drive` | 0..1 | 0.2 | — | linear |
| `pitch` | 30..80 | 48 | Hz | exponential |
| `click` | 0..1 | 0.3 | — | linear |
| `sweep` | 0..6 | 3.5 | — | linear |
| `sweep-time` | 0.005..0.2 | 0.025 | s | exponential |
| `overtone` | 0..1 | 0 | — | linear |
| `click-tone` | 100..8000 | 1500 | Hz | exponential |
| `grit` | 0..1 | 0 | — | linear |
| `level` | 0.05..2 | 1 | — | linear |

`tone` moves `decay` 0.15 → 0.9, `drive` 0 → 0.7. Patterns: the manifest's `patterns`.
Every named sound is a club kick: a 15–30 ms sweep,
`overtone` at most 0.3 and a 42–60 Hz body; they differ by drive, decay, click and grit.
`level` is the named sound's own output trim: every named sound sits within ±1.5 dB RMS of
`punch` with its peak at or under −1 dBFS before the master, checked by `pnpm sim --levels`.
The manifest is the single source of these values; this
table is copied from it.
