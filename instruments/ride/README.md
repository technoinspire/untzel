# ride

Ride cymbal, ping and wash. Engine: percussion (`packages/dsp/src/engines/percussion.rs`),
2 voices, poly, kind `drum`.

```untzel
ride x.x. x.x. x.x. x.x.
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `decay` | 0.2..8 s | 2.2 | exponential |
| `color` | 0..1  | 0.5 | linear |
| `size` | 0..1  | 0.4 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `ping` | Clear bell ping | defaults |
| `wash` | Dark wash | `color 0.3`, `size 0.8`, `decay 4` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
