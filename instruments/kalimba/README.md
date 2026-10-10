# kalimba

Thumb piano: tines and a small box. Engine: modal (`packages/dsp/src/engines/modal/`), 6 voices,
poly, kind `chord`.

```untzel
kalimba c4 . eb4 . g4 . bb4 . / g4 . eb4 . c5 . g4 .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `hardness` | 0..1 | 0.6 | linear |
| `brightness` | 0..1 | 0.5 | linear |
| `decay` | 0.1..6 s | 1.8 | exponential |
| `body` | 0..1 | 0.4 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `tine` | Warm metal tines | defaults |
| `bright` | Hard thumb, glassy upper partials, long ring | `brightness 0.95`, `hardness 0.95`, `decay 2.6`, `body 0.15` |
| `soft` | Soft thumb, dark and round | `hardness 0`, `brightness 0.1`, `decay 1.3`, `body 0.6` |
| `box` | Woody box resonance and a buzzing tine | `body 1`, `decay 0.9`, `brightness 0.35`, `noise 0.7` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
