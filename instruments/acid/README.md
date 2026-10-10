# acid

Squelchy resonant mono bass. Engine: virtual analog (`packages/dsp/src/engines/va/`),
1 voice, mono, kind `pitched`.

```untzel
acid c2 c2 c3 c2 eb2 c2 bb1 c2
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 40..12000 Hz | 700 | exponential |
| `resonance` | 0..1 | 0.6 | linear |
| `accent` | 0..1 | 0.6 | linear |
| `wave` | `saw`, `square` | `saw` | choice |
| `decay` | 0.05..2 s | 0.25 | exponential |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp24` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `drive` | 0..1 | 0 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `classic` | The classic squelch | defaults |
| `squelch` | More resonance and accent | `resonance 0.85`, `cutoff 450`, `accent 0.9` |
| `square` | Hollow square wave | `wave square` |
| `soft` | Round, a saw and a triangle in a 12 dB filter | `wave2 triangle`, `mix 0.6`, `filter lp12`, `cutoff 600`, `resonance 0.25`, `accent 0.3` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
