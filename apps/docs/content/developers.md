# For developers {#developers}

How Untzel is built, for people who want to understand it, extend it or embed it. The design is documented; the source code is not public yet.

## The source code {#source}

The repository is private while the first version is finished. The source code will be published later, under the license below. Until then this page describes the architecture, the instrument contract and the rules every contribution will follow.

## Packages and the dependency rule {#packages}

Untzel is a TypeScript monorepo with a Rust sound engine. Dependencies point inward only: the core knows nothing about the browser, Web Audio, the DOM or any interface library, and a tool checks the rule on every change.

| Layer | Packages | Responsibility |
|---|---|---|
| domain | `core`, `templates` | exact rational time, events, patterns, signals, scales, the program model, the instrument manifest contract; the template library by style |
| language | `language`, `commands` | grammar, analysis into a program, diagnostics, minimal text edits; the command line of the Code panel, which plans the same minimal edits |
| application | `transport`, `session` | scheduling ahead, bar-boundary changes, the song position and the play range; the use cases, the project library and their ports |
| adapters | `audio`, `dsp`, `visual`, `editor`, `controls`, `share`, `export` | Web Audio and the worker, the Rust DSP, the light, the code editor, the touch and keyboard controls; links, files and projects in the browser; the offline render of story, video and WAV |
| base | `i18n` | the one translation component, without DOM in its core |
| composition | the web app | the page at `app.untzel.com`, which wires everything |
| tools | `tools/sim`, `tools/docs`, `tools/release`, `tools/samples` | the simulator, these docs, the release package and the recorded instrument packs; never imported by the app |

The source text is the single source of truth of a session. Tiles, the song timeline and the editor are views that edit the same text; no gesture changes the music without going through it.

## Threads {#threads}

| Thread | Runs | Talks through |
|---|---|---|
| main | interface, editor, controls, light rendering | a `MessagePort` to the worker |
| transport worker | the transport, querying the program 120 ms ahead | `MessagePort`s to the worklet and to the main thread |
| audio (`AudioWorklet`) | the DSP, compiled from Rust to WebAssembly with no imports, scheduling by sample | a `MessagePort` to the worker |

Sound is scheduled in the worker, so a main thread busy with typing or graphics does not delay it. Time is exact fractions, never floating point, so loops do not drift. The same events drive the sound and the light.

## The instrument contract {#instrument-contract}

An instrument is a folder with a manifest and a voice:

```text
instruments/<name>/
  manifest.json   name, model, group, kind, engine, range, description, tags,
                  voices, allocation, steal, costPerVoice, patterns (name, text),
                  preview, defaultDuck, parameters (name, min, max, default, unit,
                  curve, or choices), tone mapping, toneLevelDb, presets,
                  defaultPreset, light
  voice.rs        implements the Voice trait of the DSP crate
  samples/v1/     pack.json and pack.opus, only for an instrument that plays recordings
  README.md       what it sounds like, parameters, credits
```

`patterns` holds one to six named starting patterns; the first is the one **Add track** writes, and the track detail offers them all. `model` is the name the library shows next to the language word, 3 to 20 letters, digits, spaces or hyphens, never a third party's brand. An instrument that plays recordings has a `source` parameter with the choices `synth` and `samples`, and its pack lists every source file it was built from.

The manifest is the only source of each parameter: the analyzer validates against it, the track detail draws a control for each parameter, and the [Instruments](instruments.md) page is generated from it. A parameter cannot reuse a general modifier name, an exponential curve needs a minimum above 0, and every manifest is validated when the app is built.

## Local harness {#harness}

Every change is verified locally before it is reported. The commands, for contributors with access to the source:

```sh
pnpm check          # types, unit tests, Rust tests, layer rules, license headers, docs
pnpm check:full     # check, then production build, budgets, golden files, simulator, browser tests
pnpm sim song.untzel --bars 16    # the real language, transport and DSP in Node, to WAV
pnpm test:browser   # Playwright in the installed Chrome, with screenshots
pnpm docs:check     # rebuilds these docs and fails on any drift from the code
```

The simulator renders a text to WAV without a browser and fails on any NaN, clipping or kick drift.

## Releases {#releases}

A version is published only by a tag: `vX.Y.Z`, a stable version on a commit that is already on the main branch. A merge publishes nothing. The tag runs the checks and the production build, then makes one package, `untzel-<version>.tar.gz`, with `app/` (the app), `docs/` (these pages) and, at its root, `LICENSE`, `ATTRIBUTION.md` and `TRADEMARKS.md`, which the license asks to travel with every copy. The package is deterministic: the same commit gives the same bytes. Next to it, `untzel-<version>.manifest.json` lists every file with its size and SHA-256. Each release is announced to the project's site, which serves the app at `app.untzel.com` and these docs at `untzel.com/docs/`; `untzel.com` is the site itself.

## Hosting a copy {#hosting}

The `app/` folder of a release is a static site. A copy you host yourself needs two things from the server. The first is the type `application/wasm` for the `.wasm` file: without it the sound engine loads by a slower path. The second is the app's Content-Security-Policy, the same on every response:

```text
default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'; frame-ancestors 'self'
```

It is static: no nonce, no hash and no `'unsafe-inline'`. The code editor builds its styles as constructed stylesheets, which the policy allows, so nothing in the page needs an inline style or script. The docs in `docs/` run under a stricter static policy of their own, with no WebAssembly, workers or `blob:`.

## License and attribution {#license}

The code is under CPAL-1.0, the Common Public Attribution License, an OSI-approved open source license: you may use, study, modify and share it. In return, every copy that runs for someone, including a fork, a modified or self-hosted copy and a page that embeds the player, must show the attribution: the Untzel logo, unmodified, at least 16 px high and linked to untzel.com, in the top bar; the line "Powered by Untzel · Techno Inspire", always on screen, in the footer; and the notice "Copyright (c) 2026 Techno Inspire", in the about or legal notice. Every exported video must end with the closing card of the Techno Inspire | Untzel logo and the address untzel.com. The attribution must stay legible and is never hidden, covered, cropped or made transparent. This is a condition of the license, not a request. The app itself goes further than the license asks: its videos also carry the logo and the address on every frame, and the closing card lasts 2 seconds ([Share and Export](app.md#share-export)). Third-party material the app bundles keeps its own license and credit ([Credits](credits.md)).

## Trademarks {#trademarks}

"Untzel", "Techno Inspire", the Untzel logo and the Techno Inspire logo are trademarks of Techno Inspire, and the code license does not grant them beyond the attribution it requires. The model names of the instruments (AURA Grand, VOLTA K9 and the others on the [Instruments](instruments.md) page) are Techno Inspire's names too and follow the same rules. Without asking, you may show the attribution, say truthfully that your project is based on or compatible with Untzel, and link to untzel.com. A fork keeps the attribution and takes its own name: "MyName, based on Untzel by Techno Inspire" is fine, "Untzel Pro" is not. Presenting a modified version as the official one, changing the logo, or using the names to advertise your own events or products needs written permission.

## What exists today {#features}

{{features}}
