# lead

Mono synth lead. Engine: virtual analog (`packages/dsp/src/engines/va/`),
1 voice, mono, kind `pitched`.

```untzel
lead c4 . eb4 . g4 . bb4 .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `cutoff` | 100..12000 Hz | 3500 | exponential |
| `detune` | 0..1 | 0.2 | linear |
| `wave` | `saw`, `square`, `triangle`, `sine` | `saw` | choice |
| `attack` | 0.001..2 s | 0.005 | exponential |
| `release` | 0.01..4 s | 0.25 | exponential |
| `wave2` | `saw`, `square`, `triangle`, `sine` | `square` | choice |
| `mix` | 0..1 | 0.5 | linear |
| `sync` | 0..1 | 0.45 | linear |
| `filter` | `lp12`, `lp24`, `bp`, `hp` | `lp12` | choice |
| `filter-attack` | 0.001..4 s | 0.001 | exponential |
| `drive` | 0..1 | 0.35 | linear |
| `spread` | 0..1 | 0 | linear |
| `sub` | 0..1 | 0 | linear |
| `noise` | 0..1 | 0 | linear |
| `resonance` | 0..0.95 | 0.2 | linear |
| `contour` | 0..1 | 0.25 | linear |
| `decay` | 0.02..8 s | 0.8 | exponential |
| `sustain` | 0..1 | 0.75 | linear |
| `width` | 0.05..0.95 | 0.5 | linear |
| `vibrato` | 0..1 | 0 | linear |
| `level` | 0.05..8 | 1.15 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `classic` | Bright saw and synced square | defaults |
| `soft` | Soft triangle | `cutoff 1200`, `wave triangle`, `attack 0.03`, `mix 0`, `drive 0`, `sync 0` |
| `sync` | Hard sync, edgy | `cutoff 5000`, `detune 0.6`, `wave2 saw`, `mix 1`, `sync 0.8`, `drive 0.3` |
| `screamer` | Psytrance: synced saws, hot resonant filter snapping shut | `wave saw`, `wave2 saw`, `mix 0.7`, `sync 0.85`, `detune 0.08`, `filter lp24`, `cutoff 1400`, `resonance 0.65`, `contour 0.85`, `decay 0.22`, `sustain 0.55`, `release 0.12`, `drive 0.65`, `level 2.6` |
| `anthem` | Trance: wide detuned saw and pulse with a late vibrato | `wave saw`, `wave2 square`, `mix 0.4`, `sync 0`, `detune 0.45`, `spread 0.7`, `cutoff 8500`, `resonance 0.2`, `contour 0.3`, `attack 0.004`, `decay 1.5`, `sustain 0.85`, `release 0.7`, `vibrato 0.45`, `drive 0.15`, `level 0.85` |
| `noir` | Melodic techno: dark resonant saw that blooms on each note | `wave saw`, `wave2 square`, `mix 0.3`, `sync 0`, `detune 0.15`, `filter lp24`, `cutoff 650`, `resonance 0.55`, `contour 0.65`, `decay 0.9`, `sustain 0.35`, `release 0.9`, `drive 0.25`, `spread 0.4`, `level 2` |
| `glass` | Organic melodic: breathy triangle with a soft tail | `wave triangle`, `wave2 sine`, `mix 0.5`, `sync 0`, `cutoff 4000`, `resonance 0.1`, `contour 0.1`, `attack 0.01`, `decay 0.7`, `sustain 0.25`, `release 1.4`, `vibrato 0.25`, `spread 0.5`, `noise 0.04`, `drive 0`, `level 1.7` |
| `juno` | Indie dance: chorused narrow pulse, round and warm | `wave square`, `width 0.38`, `wave2 saw`, `mix 0.25`, `sync 0`, `detune 0.3`, `spread 0.8`, `cutoff 2600`, `resonance 0.3`, `contour 0.4`, `decay 0.6`, `sustain 0.6`, `release 0.45`, `vibrato 0.15`, `drive 0.1` |
| `rave` | Acid techno: squelchy square, short and driven | `wave square`, `wave2 saw`, `mix 0.5`, `sync 0.3`, `filter lp24`, `cutoff 1800`, `resonance 0.75`, `contour 0.8`, `decay 0.25`, `sustain 0.4`, `release 0.1`, `drive 0.7`, `level 3.5` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
