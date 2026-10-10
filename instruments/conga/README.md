# conga

Hand drum, open, slap and muted. Engine: modal (`packages/dsp/src/engines/modal/`),
4 voices, poly, kind `drum`.

```untzel
conga ..x. x..x ..x. x.x.
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1 | 0.5 | linear |
| `decay` | 0.05..2 s | 0.3 | exponential |
| `bend` | 0..1 | 0.1 | linear |
| `hardness` | 0..1 | 0.5 | linear |
| `slap` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `open` | Open tone | defaults |
| `slap` | Sharp slap: skin noise and ringing high modes | `hardness 0.9`, `decay 0.14`, `slap 0.8` |
| `muted` | Palm-muted | `decay 0.08`, `hardness 0.4` |
| `low` | Low conga (tumba) | `tune 0.15` |
| `high` | High conga (quinto) | `tune 0.85` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
