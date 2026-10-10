# piano

Modeled grand piano, no samples. Engine: modal (`packages/dsp/src/engines/modal/`),
16 voices, poly, kind `chord`.

```untzel
piano Cm7 ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `hardness` | 0..1 | 0.5 | linear |
| `brightness` | 0..1 | 0.5 | linear |
| `decay` | 0.5..12 s | 5 | exponential |
| `release` | 0.05..2 s | 0.3 | exponential |
| `detune` | 0..1 | 0.3 | linear |
| `body` | 0..1 | 0.5 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `grand` | Balanced concert grand, open and long | defaults |
| `bright` | Hard hammers, bright attack | `hardness 0.95`, `brightness 0.9`, `decay 4`, `body 0.25` |
| `felt` | Soft felt, muffled, with the thump of the hammer | `hardness 0.05`, `brightness 0.1`, `noise 0.8`, `release 0.6`, `decay 3.5` |
| `upright` | Short and boxy, a strong second partial | `decay 2`, `body 1`, `hardness 0.6`, `brightness 0.3`, `detune 0.5` |
| `honky` | Out-of-tune saloon, beating string pairs | `detune 0.7`, `hardness 0.75`, `body 0.2`, `decay 2.5`, `brightness 0.4`, `noise 0.1` |
| `house` | House: bright, short, chorused stab piano | `hardness 1`, `brightness 1`, `decay 0.6`, `release 0.12`, `body 0`, `detune 0`, `noise 0.5` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
