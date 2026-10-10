# mallet

Marimba, vibes and wood. Engine: modal (`packages/dsp/src/engines/modal/`),
8 voices, poly, kind `chord`.

```untzel
mallet c4 . eb4 . g4 . eb4 .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `hardness` | 0..1 | 0.5 | linear |
| `brightness` | 0..1 | 0.5 | linear |
| `decay` | 0.1..12 s | 1 | exponential |
| `tune` | 0..1 | 0.5 | linear |
| `material` | `wood`, `metal`, `hollow` | `wood` | choice |
| `tremolo` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `marimba` | Wooden marimba | defaults |
| `vibes` | Vibraphone: metal bars, soft mallets, motor tremolo | `material metal`, `decay 9`, `hardness 0.35`, `brightness 1`, `tremolo 0.35` |
| `wood` | Short, dry hollow bar | `material hollow`, `decay 0.45`, `hardness 0.85`, `brightness 0.65` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
