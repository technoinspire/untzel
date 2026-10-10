# pluck

Plucked string, bright to muted. Engine: plucked string (`packages/dsp/src/engines/string.rs`),
12 voices, poly, kind `chord`.

```untzel
pluck c3 eb3 g3 c4 g3 eb3 c3 g2
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.6 | linear |
| `decay` | 0.1..20 s | 2.5 | exponential |
| `position` | 0..1 | 0.3 | linear |
| `body` | 0..1 | 0.4 | linear |
| `release` | 0.01..4 s | 0.15 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `bright` | Bright pick | defaults |
| `nylon` | Warm nylon | `brightness 0.33`, `body 0.65` |
| `muted` | Palm-muted | `decay 0.3`, `brightness 0.3`, `release 0.05` |
| `steel` | Steel strings | `brightness 0.85`, `position 0.15`, `decay 4`, `body 0.7` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
