# reese

Detuned rolling bass. Engine: virtual analog (`packages/dsp/src/engines/va/`),
1 voice, mono, kind `pitched`.

```untzel
reese c2 ~ ~ ~ eb2 ~ g1 ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 40..8000 Hz | 900 | exponential |
| `resonance` | 0..1 | 0.2 | linear |
| `detune` | 0..1 | 0.75 | linear |
| `release` | 0.01..2 s | 0.15 | exponential |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `mix` | 0..1 | 0 | linear |
| `sync` | 0..1 | 0 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `filter-decay` | 0.01..8 s | 0.5 | exponential |
| `drive` | 0..1 | 0.5 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0.35 | linear |
| `noise` | 0..1 | 0 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `wide` | Four saws drifting apart | defaults |
| `dark` | Low-passed, heavy ladder | `cutoff 350`, `filter lp24` |
| `growl` | Resonant, driven and moving | `resonance 0.6`, `cutoff 2200`, `detune 0.7`, `filter lp24`, `drive 0.2` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
