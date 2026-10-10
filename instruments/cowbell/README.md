# cowbell

Cowbell, classic and bright. Engine: modal (`packages/dsp/src/engines/modal/`),
2 voices, poly, kind `drum`.

```untzel
cowbell ..x. ..x. ..x. ..x.
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `tune` | 0..1  | 0.5 | linear |
| `decay` | 0.02..1 s | 0.22 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `classic` | Two-tone bell | defaults |
| `bright` | Higher and shorter | `tune 0.75`, `decay 0.14` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
