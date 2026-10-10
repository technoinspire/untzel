# epiano

Electric piano, FM tines. Engine: FM (`packages/dsp/src/engines/fm.rs`),
12 voices, poly, kind `chord`.

```untzel
epiano Cm7 ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `brightness` | 0..1 | 0.55 | linear |
| `decay` | 0.1..8 s | 2 | exponential |
| `release` | 0.01..8 s | 0.4 | exponential |
| `detune` | 0..1 | 0.3 | linear |
| `tine` | 0..1 | 0.7 | linear |
| `tremolo` | 0..1 | 0.4 | linear |

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `tine` | Classic tines with the suitcase autopan | defaults |
| `bell` | Bell-like and clear, a loud tine | `brightness 0.75`, `tine 1`, `decay 3.5`, `tremolo 0` |
| `soft` | Mellow and warm | `brightness 0.18`, `tine 0.2` |
| `bark` | Driven and barking, short | `brightness 1`, `decay 0.8`, `tine 0.3`, `tremolo 0.7` |

## Credits

Written for Untzel by Techno Inspire. No audio samples, no code or tables from other
synthesizers.
