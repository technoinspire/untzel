# Contributing to Untzel

Thank you for helping. Untzel is an audiovisual instrument for the browser, and there is
room for musicians, sound designers, visual artists, writers, translators and developers.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## What you can contribute

- **Instruments**: a new voice, a better preset, a recorded sample pack.
- **Light scenes**: how an instrument looks on the stage.
- **Templates**: a starting point in a style the library does not have yet.
- **The language**: a clearer error message, a missing pattern feature, a grammar fix.
- **Docs and translations**: the public docs live in English and Portuguese.
- **Reports**: a bug, a sound that is off, a page that is wrong. Use the
  [issue forms](https://github.com/technoinspire/untzel/issues/new/choose).

## Before you start

- For anything bigger than a small fix, open an issue or a
  [discussion](https://github.com/technoinspire/untzel/discussions) first, so we can agree on
  the direction before you write code.
- A change in behavior updates the user docs in [`apps/docs/content/`](apps/docs/content): the
  English page and its `.pt-BR.md` translation. Issues and pull requests are welcome in
  English or Portuguese.

## Contributor License Agreement

Untzel's code is under CPAL-1.0, and you keep the copyright of what you write. To let Techno
Inspire keep maintaining, relicensing and offering Untzel alongside its other products, every
contribution is made under the [Untzel Contributor License Agreement](CLA.md). It grants a
license; it does not take your copyright away.

To accept it, check the CLA line at the end of the pull request template. The `cla` check
confirms it; a pull request without it is not merged.

## Development setup

Follow [Local development](README.md#local-development) in the README, then run:

```sh
pnpm run doctor   # checks Node, pnpm, Rust, the wasm target and Chrome, and says how to fix
```

## Engineering standards

These standards apply to every change in this repository. Maintainers hold their own work
to them, and reviewers apply them to every pull request.

1. **Code is English, always.** Identifiers, file names, package names, comments, commit
   messages, Untzel language keywords and error messages. Everything else in the repository
   (this guide, the README, the policies, the GitHub templates and forms, script help texts)
   is English too. Product localization is the one exception: the UI catalogs
   (`*.pt-BR.ts`) and the Portuguese pages of the user docs (`apps/docs/content/*.pt-BR.md`)
   are i18n content and stay in Brazilian Portuguese.
2. **Dependencies point inward.** `core` imports nothing. `language` and `transport` build
   on `core`; `session` builds on `core`, `language` and `transport`. The adapters (`audio`,
   `light`, `editor`, `export`, `share`, `presentation` and the skins) build on the domain
   packages, and only on the other adapters their rule allows. `apps/web` is the composition
   root and only wires. The rules are executable in `.dependency-cruiser.cjs` and checked by
   `pnpm lint:deps`; the package map is on the
   [developers page](https://untzel.com/docs/developers#packages).
3. **The source text is the single source of truth** for a session. Track controls, the
   song timeline and the editor are views that edit the same text.
4. **Never break the music.** Invalid code keeps the last valid program playing.
5. **Realtime safety.** The DSP is Rust compiled to WebAssembly with zero imports
   (`pnpm check:wasm` checks it). On the audio thread the render path creates no objects and
   calls no allocating export; allocation happens only in the message handler.
6. **Pinned dependencies.** Exact versions, checked against the registry, never from
   memory. GitHub Actions are pinned by commit SHA.
7. **License and brand.** Code is CPAL-1.0. Every source file starts with the license
   header:

   ```text
   SPDX-License-Identifier: CPAL-1.0
   Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
   ```

   `node tools/headers/check-headers.mjs --fix` adds it for you. The attribution (the logo,
   "Powered by Untzel · Techno Inspire" and the link) stays visible in the interface, the
   player and every exported video. Never remove it.
8. **Verify locally.** Run `pnpm check` before you push and `pnpm check:full` before a
   feature is done. Use `pnpm sim` to validate sound without a browser. The
   [Checks](#checks) table below says when to run each one, and the
   [developers page](https://untzel.com/docs/developers#harness) describes the harness.
9. **Clean Architecture and Clean Code, always.**
   - **One component, one responsibility, one file.** A UI component (a view: a sheet, a
     strip, a tile, a gutter, a popup) lives in its own file with its own small test. No
     file grows into a screen-sized "god" module: split by reason to change, not by line
     count. As a guide, a source file above ~300 lines or a function above ~40 lines needs
     a reason in the review.
   - **Views are dumb.** A view receives a view model and emits intents. It never parses,
     never edits the source text, never talks to audio, and holds no domain state.
     Presentation logic (formatting labels, choosing colors) lives in plain functions next
     to the view and is unit tested without the DOM.
   - **Domain stays pure.** Rules live in `core`, `language`, `transport` and `session` as
     functions and use cases with no DOM, no Web Audio, no timers of their own. Adapters
     translate; the composition root (`apps/web`) only wires.
   - **Small interfaces.** Ports and view models expose only what their consumer needs;
     split an interface rather than adding optional members.
   - **Names reveal intent.** No abbreviations, no `utils`/`helpers`/`misc` dumping
     grounds, no dead or commented-out code, no duplicated logic.
   - **New package or new component, not a bigger one.** When a feature adds a new concern
     (for example the command line, an export format, a language mode), it gets its own
     module with a public entry point, placed in the dependency map with a rule in
     `.dependency-cruiser.cjs`.

Reviewers reject a change that breaks these standards, even when the tests pass.

## Checks

| When | Run |
|---|---|
| always, before you push | `pnpm check`: types, unit tests, Rust tests, layer rules, the public docs, translations and license headers |
| a feature or a larger change | `pnpm check:full`: the above, Rust lint and format, the build, size budgets, golden files, the sound gates and the browser tests |
| you changed a sound | `pnpm sim <file.untzel>`: plays the text without a browser and writes a WAV and a report |
| you changed the interface | `pnpm test:browser`: Playwright on your installed Chrome |
| you changed Markdown | the CI also runs markdownlint and an offline link check (lychee) |

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), in English:

```text
feat(language): parse probability suffix on elements
fix(transport): swap program on the next unscheduled bar boundary
docs(instruments): explain the kalimba presets
```

Scopes are the package names (`core`, `language`, `transport`, `session`, `scene`, `light`,
`audio`, `dsp`, `editor`, `commands`, `presentation`, `skin-contract`, `skins`, `share`,
`export`, `take`, `templates`, `instrument-index`, `i18n`), plus `web`, `docs`,
`instruments`, `ci` and `deps`.

## Pull requests

- Branch from `main`: `feat/<topic>`, `fix/<topic>`, `docs/<topic>` or `chore/<topic>`.
- Fill in the template: **Summary**, **Verification** and **Docs**.
- If the interface changes, add screenshots at 1440 × 900 and 390 × 844.
- If the change is something people can see or hear in the app, add a changelog entry
  `changelog/entries/<name>.json` in English and Portuguese, as
  [`changelog/README.md`](changelog/README.md) shows. Refactors, tests and tooling do not need
  one; a maintainer applies the `no-changelog` label.
- Keep the CLA line checked.
- Pull requests are merged by squash; the title becomes the commit message.

## Contributing an instrument, a light scene or a template

- **Instrument.** The public contract is described at
  [untzel.com/docs/developers](https://untzel.com/docs/developers#instrument-contract): a
  folder in `instruments/<name>/` with a manifest, a voice in Rust and, for a recorded
  instrument, a sample pack.
- **Sample pack.** Only recordings in the public domain, CC0 or CC BY can be bundled, as
  [`THIRD_PARTY.md`](THIRD_PARTY.md) lists. The pack names every source file, and the credit
  goes into `credits.json` and `THIRD_PARTY.md`; `pnpm docs:check` fails when a pack has no
  credit.
- **Light scene.** The light engine follows the same scheduled events as the sound, as the
  [developers page](https://untzel.com/docs/developers#threads) describes. A scene has flash
  limits, so open an issue first and we agree on them before you write code.
- **Template.** Templates live in [`apps/web/src/templates/`](apps/web/src/templates), one
  folder per style. A template change is checked by `pnpm sim:golden`.

## Review process

- Every pull request is reviewed by the maintainers listed in
  [`.github/CODEOWNERS`](.github/CODEOWNERS).
- The workflows of a first-time contributor run after a maintainer approves them.
- A change is accepted when the checks pass, the docs match, and the code follows
  [the engineering standards](#engineering-standards), including standard 9 (Clean
  Architecture and Clean Code). Reviewers reject a change that breaks these standards even
  when the tests pass.
- We do not promise a review time. We answer as soon as we can.

## Governance

- Untzel is maintained by [Techno Inspire](https://technoinspire.com.br), which has the final
  say on what is merged.
- Significant changes are agreed in an issue or discussion before the code.
- The names and logos are trademarks of Techno Inspire: see [`TRADEMARKS.md`](TRADEMARKS.md).

## Code of conduct and security

- Be kind: [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).
- Found a security problem? Report it privately, as [`SECURITY.md`](SECURITY.md) explains.
