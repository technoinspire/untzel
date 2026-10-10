# vox

Singing voice. Engines: formant (`packages/dsp/src/engines/formant.rs`) and, with
`source samples`, a recorded solo singer (`packages/dsp/src/engines/sampler/`), 1 voice,
mono, kind `pitched`.

```untzel
vox c4 ~ eb4 ~ g4 ~ ~ .
vox ooh c4 ~ eb4 ~ g4 ~ ~ .
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `vowel` | 0..1  | 0 | linear |
| `breath` | 0..1  | 0.15 | linear |
| `brightness` | 0..1  | 0.6 | linear |
| `attack` | 0.001..2 s | 0.02 | exponential |
| `release` | 0.01..4 s | 0.2 | exponential |
| `source` | `synth`, `samples` | `synth` | choice |

With `source samples`, `vowel` blends the recorded aah (0) and ooh (1) with equal
power, `brightness` 0.5 leaves the recording as it is (0 darker, 1 brighter) and
`breath` is the singer's own. The pack loads the first time a text uses it; until then,
or if it cannot load, the track sings on the formants.

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `talk` | Talking vowel | defaults |
| `ooh` | Sung ooh, recorded singer | `vowel 1`, `source samples` |
| `aah` | Sung aah, recorded singer | `source samples` |
| `robot` | Robotic, no breath | `breath 0`, `brightness 0.9` |

## Credits

Code written for Untzel by Techno Inspire. The recorded singer of `source samples` is
from VocalSet (Wilkins, Seetharaman, Wahl and Pardo, 2018), CC BY 4.0, Zenodo record
1442513 (version 1.2), archive `VocalSet11.zip`: the baritone `m6` up to G4 and the
mezzo-soprano `f8` from A4. Built by `tools/voices/`; sources, checksums and changes in
`samples/v1/pack.json` and [THIRD_PARTY.md](../../THIRD_PARTY.md).
