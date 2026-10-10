# clap

Hand clap, tight to roomy. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
4 voices, poly, kind `drum`.

```untzel
clap .... x... .... x...
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.05..1 s | 0.18 | exponential |
| `spread` | 0..1  | 0.4 | linear |
| `color` | 0..1  | 0.5 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `tight` | Short and close | defaults |
| `roomy` | Longer tail, wider bursts | `decay 0.45`, `spread 0.75` |
| `snap` | Bright and sharp | `decay 0.14`, `color 0.85`, `spread 0.3` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
