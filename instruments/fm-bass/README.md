# fm-bass

FM bass, plucky to metallic. Engine: FM (`packages/dsp/src/engines/fm.rs`),
1 voice, mono, kind `pitched`.

```untzel
fm-bass c2 . c2 . eb2 . c2 g1
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.45 | linear |
| `feedback` | 0..1 | 0.4 | linear |
| `decay` | 0.05..4 s | 0.35 | exponential |
| `release` | 0.01..2 s | 0.1 | exponential |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `pluck` | Plucked, growling digital bass | defaults |
| `metal` | Hard and metallic | `brightness 0.8`, `feedback 0.5` |
| `round` | Soft and round | `brightness 0.2`, `decay 0.7`, `feedback 0.1` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
