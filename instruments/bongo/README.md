# bongo

Two small hand drums: the high one and the low one. Engine: modal (`packages/dsp/src/engines/modal/`), 4 voices,
poly, kind `drum`.

```untzel
bongo x.x. .x.x x.x. .xx.
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1 | 0.6 | linear |
| `decay` | 0.05..1 s | 0.18 | exponential |
| `hardness` | 0..1 | 0.6 | linear |
| `slap` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `high` | Small drum, high | defaults |
| `low` | Large drum, low | `tune 0.2` |
| `slap` | Dry slap: skin noise and high modes | `hardness 0.9`, `decay 0.08`, `slap 0.9` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
