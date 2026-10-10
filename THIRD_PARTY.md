# Third-party material

Untzel's code is CPAL-1.0 ([LICENSE](LICENSE), [ATTRIBUTION.md](ATTRIBUTION.md)). The
material below is not Untzel's: it keeps its own license, and the credit it asks for
travels with every copy. The same entries, machine-readable, are in
[`credits.json`](credits.json).

Accepted licenses for bundled material: CC0, public domain and CC BY, and the SIL Open
Font License 1.1 for fonts. Not accepted:
CC BY-SA, NC or ND variants, "Sampling Plus", any GPL, and packs without a clear
license.

## VocalSet — sung vowels of `vox` and `choir`

| Field | Value |
|---|---|
| Material | VocalSet: A Singing Voice Dataset, Zenodo record 1442513 (version 1.2), archive `VocalSet11.zip` |
| Authors | Julia Wilkins, Prem Seetharaman, Alison Wahl, Bryan Pardo (Northwestern University) |
| Singers | the 20 professional singers of VocalSet, anonymous in the dataset (f1–f9, m1–m11); the packs use f2–f9 and m1–m9 |
| Source | <https://zenodo.org/records/1442513> · DOI [10.5281/zenodo.1442513](https://doi.org/10.5281/zenodo.1442513) |
| License | [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/), as the Zenodo record states (checked 03/10/2026) |
| Used in | `instruments/vox/samples/v1/pack.opus`, `instruments/choir/samples/v1/pack.opus` |
| Built by | `tools/voices/build_voice_packs.py`; every source file and its SHA-256 is listed in each `pack.json` |

Citation, as the dataset asks:

> Julia Wilkins, Prem Seetharaman, Alison Wahl and Bryan Pardo. VocalSet: A Singing
> Voice Dataset. In Proceedings of the 19th International Society for Music
> Information Retrieval Conference (ISMIR), Paris, 2018.

Changes made: held notes were cut from the straight long tones on the vowels a and u,
moved to each zone's root pitch by pitch-synchronous overlap-add (and resampling past
7 semitones), summed into two-stem ensembles of 3 to 6 singers for the choir with small
onset delays and detunes, band-limited to 16 kHz, levelled, looped with a baked
crossfade and encoded as Ogg Opus at 64 kbit/s. The recordings are not endorsed by
their authors or singers.

## DSP algorithms

DSP algorithms ported from permissive open-source projects follow the rules below. Each
project gets a `## <Project>` section with its author, URL, license, the upstream files
used, the full notice and the Untzel files derived from it. Each of those files carries the line
`Portions derived from <Project> (<license>), see THIRD_PARTY.md`, and
`tools/headers/check-headers.mjs` checks that it is listed here.

Allowed sources: Mutable Instruments (the STM32 projects only, MIT) and STK (MIT-STK).
Forbidden: GPL, LGPL and AGPL (Surge XT, Vital, Dexed, the Mutable Instruments AVR
projects). No third-party DSP code has been ported so far, so there is no project
section yet.

## Recorded instruments

The packs in `instruments/{piano,strings,harp,mallet,bell,kalimba}/samples/v1/` are built by
`tools/samples/build.py` from these recordings: cut at the onset, mixed to mono, resampled to
48 kHz, levelled, peak-limited, looped or faded, and encoded as Opus. Each `pack.json` lists
the exact source files.

| Pack | Source | Author | License |
|---|---|---|---|
| piano | [Salamander Grand Piano V3](https://github.com/sfzinstruments/SalamanderGrandPiano) (Yamaha C5) | Alexander Holm | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| strings, harp | [VSCO 2 Community Edition](https://github.com/sgossner/VSCO-2-CE) | Versilian Studios LLC | CC0 1.0 |
| mallet, bell, kalimba, conga, bongo, cowbell, woodblock, shaker, clap, hat | [Versilian Community Sample Library](https://github.com/sgossner/VCSL) | Versilian Studios LLC | CC0 1.0 |

"Salamander Grand Piano V3" by Alexander Holm, licensed under CC BY 3.0, modified as above.

## Fonts

The interface fonts are bundled in `apps/web/public/fonts/` (and the same files in
`apps/ui-preview/public/fonts/`), subset to Latin and served as WOFF2. The full text of the
SIL Open Font License 1.1 ships next to each font, as the license asks.

| Font | Source | Copyright | License | Files |
|---|---|---|---|---|
| Hanken Grotesk | <https://github.com/marcologous/hanken-grotesk> | The Hanken Grotesk Project Authors | [OFL-1.1](https://openfontlicense.org/open-font-license-official-text/) | `hanken-grotesk-400-600-latin.woff2`, `OFL-Hanken-Grotesk.txt` |
| Jost | <https://github.com/indestructible-type/Jost> | The Jost Project Authors | [OFL-1.1](https://openfontlicense.org/open-font-license-official-text/) | `jost-normal-400-latin.woff2`, `OFL-Jost.txt` |

## Bundled libraries

The web build bundles these npm packages, read from the `dependencies` of
`packages/editor`, `packages/language` and `packages/export` and from the build output
(versions pinned in `pnpm-lock.yaml`). The build writes the full license text of each one to
`third-party-licenses.md` at the root of the app (`apps/web/dist/third-party-licenses.md`),
and `pnpm budgets` fails when that file is missing or does not name `@codemirror/view`,
`@lezer/lr` and `mediabunny`.

| Package | Version | Used by | Copyright | License |
|---|---|---|---|---|
| `@codemirror/autocomplete` | 6.20.3 | editor | Marijn Haverbeke and others | MIT |
| `@codemirror/commands` | 6.11.1 | editor | Marijn Haverbeke and others | MIT |
| `@codemirror/language` | 6.12.4 | editor | Marijn Haverbeke and others | MIT |
| `@codemirror/lint` | 6.9.7 | editor | Marijn Haverbeke and others | MIT |
| `@codemirror/state` | 6.7.6 | editor | Marijn Haverbeke and others | MIT |
| `@codemirror/view` | 6.43.13 | editor | Marijn Haverbeke and others | MIT |
| `@lezer/common` | 1.5.3 | language, editor | Marijn Haverbeke and others | MIT |
| `@lezer/highlight` | 1.2.5 | language, editor | Marijn Haverbeke and others | MIT |
| `@lezer/lr` | 1.4.10 | language | Marijn Haverbeke and others | MIT |
| `@marijn/find-cluster-break` | 1.0.4 | editor (through `@codemirror/view`) | Marijn Haverbeke | MIT |
| `crelt` | 1.0.7 | editor (through `@codemirror/view`) | Marijn Haverbeke | MIT |
| `style-mod` | 4.1.4 | editor (through `@codemirror/view`) | Marijn Haverbeke and others | MIT |
| `w3c-keyname` | 2.2.8 | editor (through `@codemirror/view`) | Marijn Haverbeke and others | MIT |
| `mediabunny` | 1.61.0 | export worker | Vanilagy | [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/) |

`style-mod` carries one change, `patches/style-mod@4.1.4.patch`: style sheets are adopted by
documents too, so the editor runs under a static Content-Security-Policy without a nonce.

Mediabunny is used unmodified: the export worker bundles its files, minified, as published
in version 1.61.0. Its source code, under MPL-2.0, is at
<https://github.com/Vanilagy/mediabunny/tree/v1.61.0> and in the npm package
<https://registry.npmjs.org/mediabunny/-/mediabunny-1.61.0.tgz>.

## Techniques ported into the light engine

The scene pipeline in `packages/light` ports four published techniques as algorithms. No
third-party file, shader or preset is vendored: each function was written by us after the
source, and the MIT notices below are kept for credit. Shadertoy shaders (CC BY-NC-SA by
default), LYGIA (Prosperity, non-commercial), Hydra (AGPL), three.js and any GPL code were
not used. Licenses checked on
04/10/2026.

| Source | License | What was ported | Where |
|---|---|---|---|
| [webgl-noise](https://github.com/stegu/webgl-noise), Ashima Arts and Stefan Gustavson | MIT ("Copyright (C) 2011 by Ashima Arts (Simplex noise); Copyright (C) 2011-2016 by Stefan Gustavson") | 2D simplex noise: the skewed lattice, three corners, radial falloff | `packages/light/src/composer/flow-noise.ts` (`flowNoise`, `FLOW_NOISE_GLSL`) |
| [psrdnoise](https://github.com/stegu/psrdnoise), Stefan Gustavson and Ian McEwan | MIT ("Copyright 2021 Stefan Gustavson and Ian McEwan") | flow noise (gradients that turn with time) and the curl of the noise field for the dust | `packages/light/src/composer/flow-noise.ts` (`flowNoise`, `curl`, `curlAdvect`) |
| Inigo Quilez, ["2D distance functions"](https://iquilezles.org/articles/distfunctions2d/) | only the functions the article marks MIT were followed | signed distances of the segment, the box and the ring, the arc mask, the ellipse's first-order estimate; one-pixel anti-aliasing | `packages/light/src/renderers/webgl2/figure-shader.ts` |
| [Butterchurn](https://github.com/captbaritone/butterchurn), Jordan Berg | MIT ("Copyright (c) 2013-2018 Jordan Berg"), the engine only | the feedback technique: warp and fade the previous frame under the new one. No MilkDrop preset is used (their licenses vary) | `packages/light/src/composer/feedback-schedule.ts`, `renderers/webgl2/post-shaders.ts` (`TRAIL_STEP_FRAGMENT`) |
| Dual-filter bloom, Marius Bjørge, "Bandwidth-Efficient Rendering", SIGGRAPH 2015 | an algorithm from a talk; implemented by us | four taps on the way down, an eight-tap tent on the way up, five half-resolution levels | `packages/light/src/renderers/webgl2/post-shaders.ts` (`BLOOM_DOWN_FRAGMENT`, `BLOOM_UP_FRAGMENT`), `post-pass.ts` |

The MIT license of each source, as its notice asks:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this
> software and associated documentation files (the "Software"), to deal in the Software
> without restriction, including without limitation the rights to use, copy, modify,
> merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
> permit persons to whom the Software is furnished to do so, subject to the following
> conditions: The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
> WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
