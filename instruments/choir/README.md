# choir

Choir of recorded singers. Engines: a sampled ensemble
(`packages/dsp/src/engines/sampler/`) and, with
`source synth`, formant (`packages/dsp/src/engines/formant.rs`); 8 voices, poly, stereo,
kind `chord`.

```untzel
choir Cm ~ ~ ~
```

## Parameters

| Parameter | Range | Default | Curve |
|---|---|---|---|
| `vowel` | 0..1 | 0 | linear |
| `breath` | 0..1 | 0.25 | linear |
| `brightness` | 0..1 | 0.5 | linear |
| `attack` | 0.01..8 s | 0.5 | exponential |
| `release` | 0.01..8 s | 1 | exponential |
| `detune` | 0..1 | 0.4 | linear |
| `source` | `synth`, `samples` | `samples` | choice |

With `source samples` each zone is 3 to 6 singers in two stems, left and right (4 or
more from c3 up on aah and in every ooh zone; the three aah zones below c3 have 3,
because only three singers hold an aah that low); `detune` pulls the stems apart (up
to 12 cents), `vowel` blends aah (0) and ooh (1) with equal power and `brightness` 0.5
leaves the recording as it is. The pack loads the first time a text uses it; until
then, or if it cannot load, the track sings on the formants, centred. `source synth` is
the formant choir: three detuned voices per note, `vowel` through a, e, i, o, u.

## Sounds

| Sound | What it is | Values |
|---|---|---|
| `aah` | Open aah, recorded ensemble | defaults |
| `ooh` | Round ooh, recorded ensemble | `vowel 0.9` |
| `dark` | Dark and low | `brightness 0.2`, `vowel 0.75`, `source synth` |
| `chant` | Open chant, call and response | `vowel 0.15`, `breath 0.25`, `brightness 0.65`, `attack 0.04`, `source synth` |
| `gospel` | House: bright open gospel voices | `source samples`, `vowel 0.45`, `brightness 1`, `attack 0.01`, `release 0.6`, `detune 0.35` |
| `ethereal` | Trance: airy voices that swell in | `source synth`, `vowel 0.3`, `breath 0.7`, `brightness 0.8`, `attack 1.2`, `release 3.5`, `detune 0.4` |
| `monk` | Melodic techno: low closed chant | `source samples`, `vowel 1`, `brightness 0`, `attack 0.3`, `release 1.5`, `detune 0.1` |

## Credits

Code written for Untzel by Techno Inspire. The recorded ensemble is made from VocalSet
(Wilkins, Seetharaman, Wahl and Pardo, 2018), CC BY 4.0, Zenodo record 1442513
(version 1.2), archive `VocalSet11.zip`, singers f2–f9 and m1–m9. Built by
`tools/voices/`; sources, checksums and changes in `samples/v1/pack.json` and
[THIRD_PARTY.md](../../THIRD_PARTY.md).
