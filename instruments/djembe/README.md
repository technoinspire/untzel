# djembe

Goblet hand drum with a deep bass, an open tone and a slap. Engine: modal (`packages/dsp/src/engines/modal/`), 4 voices,
poly, kind `drum`.

```untzel
djembe x..x ..x. x.x. ..x.
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1 | 0.45 | linear |
| `decay` | 0.05..2 s | 0.35 | exponential |
| `bend` | 0..1 | 0.05 | linear |
| `hardness` | 0..1 | 0.55 | linear |
| `slap` | 0..1 | 0.25 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `tone` | Open tone at the edge, a touch of slap | defaults |
| `bass` | Deep bass in the middle | `tune 0.1`, `hardness 0.3`, `decay 0.5`, `slap 0` |
| `slap` | Sharp slap | `hardness 0.95`, `decay 0.12`, `slap 1` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
