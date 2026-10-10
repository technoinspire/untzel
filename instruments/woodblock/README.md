# woodblock

A hollow wooden block, from a click to a knock. Engine: modal (`packages/dsp/src/engines/modal/`), 2 voices,
poly, kind `drum`.

```untzel
woodblock ..x. ..x. .x.. x...
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1  | 0.6 | linear |
| `decay` | 0.02..1 s | 0.12 | exponential |
| `hardness` | 0..1  | 0.7 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `high` | Small block, high | defaults |
| `low` | Large block, low | `tune 0.2` |
| `hollow` | Hollow and longer | `decay 0.25`, `tune 0.4` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
