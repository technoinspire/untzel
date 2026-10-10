// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The dependency rules of the packages, executable by pnpm lint:deps.
// Over 300 lines: one rule per package boundary.
const notTest = "\\.test\\.ts$";
const assetQuery = "[?](url|worker|worker&url|raw|inline)$";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "core-depends-on-nothing",
      severity: "error",
      from: { path: "^packages/core/src", pathNot: notTest },
      to: { pathNot: "^packages/core/" },
    },
    {
      name: "i18n-core-depends-on-nothing",
      severity: "error",
      comment: "The translation core has no DOM and no domain: it only imports itself.",
      from: { path: "^packages/i18n/src", pathNot: [notTest, "^packages/i18n/src/dom/"] },
      to: { pathNot: "^packages/i18n/src/(?!dom/)" },
    },
    {
      name: "i18n-dom-only-in-adapters",
      severity: "error",
      comment: "core, language, commands, transport and session never see the browser side of i18n.",
      from: { path: "^packages/(core|language|commands|transport|session)/src" },
      to: { path: "^packages/i18n/src/dom/" },
    },
    {
      name: "language-allowed",
      severity: "error",
      from: { path: "^packages/language/src", pathNot: notTest },
      to: {
        // The i18n core only: diagnostic messages are a catalog (the dom side is ruled out below).
        pathNot: "^packages/(core|language)/|^packages/i18n/src/(?!dom/)|node_modules/@lezer/(lr|common|highlight)/",
      },
    },
    {
      name: "scene-allowed",
      severity: "error",
      comment: "The light's domain is pure: scene choice, placement, seeds and palette over core only.",
      from: { path: "^packages/scene/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|scene)/" },
    },
    {
      name: "palette-subpath-only",
      severity: "error",
      comment: "Skins and the editor show the track colours: they read @untzel/scene/palette, never the scene model.",
      from: { path: "^packages/(skins/[^/]+|editor)/src", pathNot: notTest },
      to: { path: "^packages/scene/src/", pathNot: "^packages/scene/src/palette\\.ts$" },
    },
    {
      name: "transport-allowed",
      severity: "error",
      from: { path: "^packages/transport/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|transport)/" },
    },
    {
      name: "session-allowed",
      severity: "error",
      from: { path: "^packages/session/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|language|transport|session)/" },
    },
    {
      name: "take-allowed",
      severity: "error",
      comment: "The take: core and the session only, as types; no DOM, no timer, no language, transport, audio or export.",
      from: { path: "^packages/take/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|take)/" },
    },
    {
      name: "take-core-session-types-only",
      severity: "error",
      comment: "Types only, except the source length limit (@untzel/session/limits).",
      from: { path: "^packages/take/src", pathNot: notTest },
      to: {
        path: "^packages/(core|session)/",
        pathNot: "^packages/session/src/limits\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "take-replay-for-renderers",
      severity: "error",
      comment: "Only the export worker's take chunk and the simulator replay a take; the take's own entry never does.",
      from: { pathNot: "^(apps/web/src/export/|tools/sim/src/|packages/take/src/replay/)" },
      to: { path: "^packages/take/src/replay/" },
    },
    {
      name: "take-entry-consumers",
      severity: "error",
      comment: "No product package knows the take: apps/web and tools only (views and the presentation layer included).",
      from: { path: "^(packages|instruments)/", pathNot: "^packages/take/" },
      to: { path: "^packages/take/" },
    },
    {
      name: "take-only-in-the-demo-hooks",
      severity: "error",
      comment: "The app has no Record: only the test build's demo hooks and the take capture they drive know the take.",
      from: { path: "^apps/web/src/", pathNot: [notTest, "^apps/web/src/testing/", "^apps/web/src/adapters/take/"] },
      to: { path: "^packages/take/" },
    },
    {
      name: "presentation-allowed",
      severity: "error",
      comment:
        "The presenters and the view model: the session's view in, the screens' view model out. Core and the session only: no DOM, no adapter, no catalog (the words arrive injected).",
      from: { path: "^packages/presentation/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|presentation)/" },
    },
    {
      name: "presentation-small-entries-types-only",
      severity: "error",
      comment:
        "@untzel/presentation/view-model and /waiting are in the initial JS: at run time they reach only each other; core, the session and the presenters only as types, so neither the parser nor the presenters reach the first screen.",
      from: { path: "^packages/presentation/src/(view-model/|waiting-view\\.ts$)", pathNot: notTest },
      to: {
        path: "^packages/(core|session)/|^packages/presentation/src/(?!view-model/|waiting-view\\.ts$)",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "instrument-index-allowed",
      severity: "error",
      comment:
        "The instrument index is a catalog over core: the manifests of instruments/, which only its generated file reads, and the registry built from them.",
      from: { path: "^packages/instrument-index/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|instrument-index)/|^instruments/[^/]+/manifest\\.json$" },
    },
    {
      name: "only-generated-files-read-instruments",
      severity: "error",
      comment:
        "instruments/ is read through the index: only the files pnpm generate writes import a manifest or a sample pack, so adding an instrument edits no list.",
      from: { pathNot: "^(packages/instrument-index/src/generated|apps/web/src/generated)/" },
      to: { path: "^instruments/" },
    },
    {
      name: "instrument-index-for-the-composition-and-tools",
      severity: "error",
      comment: "The packages receive a registry; only the composition, the tools and the tests read the index.",
      from: { path: "^(packages|instruments)/", pathNot: ["^packages/instrument-index/", "\\.test\\.ts$"] },
      to: { path: "^packages/instrument-index/" },
    },
    {
      name: "templates-depends-on-nothing",
      severity: "error",
      comment: "The template catalog is a pure function over file texts; the page and the simulator read the folder.",
      from: { path: "^packages/templates/src", pathNot: notTest },
      to: { pathNot: "^packages/templates/" },
    },
    {
      name: "templates-for-the-composition-and-tools",
      severity: "error",
      comment: "Only apps/web, tools/sim and tools/docs read the library; skins receive a view model.",
      from: { path: "^(packages|instruments)/", pathNot: "^packages/templates/" },
      to: { path: "^packages/templates/" },
    },
    {
      name: "commands-allowed",
      severity: "error",
      comment: "The terminal's command layer: text in, a proposal out. No session, DOM or network; the i18n core for its copy.",
      from: { path: "^packages/commands/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|language|commands)/|^packages/i18n/src/(?!dom/)" },
    },
    {
      name: "audio-allowed",
      severity: "error",
      comment: "Audio adapts the session's ports; the DSP arrives as a compiled module, never as an import.",
      from: { path: "^packages/audio/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|audio)/" },
    },
    {
      name: "skin-allowed",
      severity: "error",
      comment:
        "A skin draws the interface and sends intents; it reads the skin contract, session ports, core manifest types, the view model, the i18n core and DOM adapter, and itself.",
      from: { path: "^packages/skins/([^/]+)/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|i18n|skin-contract)/|^packages/presentation/src/view-model/|^packages/skins/$1/" },
    },
    {
      name: "skin-views-are-dumb",
      severity: "error",
      comment:
        "A view receives a view model and emits intents (views are dumb): it imports its own skin, core and the view model only. Its -model.ts may anticipate the session's rules through @untzel/session/rules.",
      from: { path: "^packages/skins/([^/]+)/src/views/", pathNot: [notTest, "-model\\.ts$"] },
      to: { pathNot: "^packages/(core|skin-contract)/|^packages/skins/$1/|^packages/presentation/src/view-model/" },
    },
    {
      name: "skin-views-core-types-only",
      severity: "error",
      comment:
        "Views read core types; a value computed with core (a pitch class, the group list) arrives in the view model or from the view's -model.ts.",
      from: { path: "^packages/skins/[^/]+/src/views/", pathNot: [notTest, "-model\\.ts$"] },
      to: { path: "^packages/core/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "skin-session-rules-only",
      severity: "error",
      comment:
        "A skin never runs session code: at run time it reaches it only through @untzel/session/rules, the pure rules it anticipates.",
      from: { path: "^packages/skins/[^/]+/src", pathNot: notTest },
      to: {
        path: "^packages/session/",
        pathNot: "^packages/session/src/rules\\.ts$",
        dependencyTypesNot: ["type-only"],
      },
    },
    {
      name: "skin-contract-allowed",
      severity: "error",
      comment:
        "The skin contract names what any skin receives and emits: core, the session, the i18n core and the view model, and itself.",
      from: { path: "^packages/skin-contract/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|skin-contract)/|^packages/i18n/src/(?!dom/)|^packages/presentation/src/view-model/" },
    },
    {
      name: "skin-contract-types-only",
      severity: "error",
      comment: "At run time the contract reaches no other package: what it reads of core, the session, i18n and the view model is a type.",
      from: { path: "^packages/skin-contract/src", pathNot: notTest },
      to: { path: "^packages/(core|session|i18n|presentation)/", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "skins-are-independent",
      severity: "error",
      comment: "A skin is one way to draw the interface; it never reads another skin.",
      from: { path: "^packages/skins/([^/]+)/" },
      to: { path: "^packages/skins/", pathNot: "^packages/skins/$1/" },
    },
    {
      name: "skins-for-the-composition-and-tools",
      severity: "error",
      comment: "Only the composition, the preview and the tools mount or read a skin; no package below it depends on the interface.",
      from: { path: "^(packages|instruments)/", pathNot: "^packages/skins/" },
      to: { path: "^packages/skins/" },
    },
    {
      name: "composition-skin-by-alias",
      severity: "error",
      comment:
        "apps/web reaches the skin only through @untzel/skin, the one line of apps/web/package.json that chooses it; a relative path into packages/skins/ would bypass it.",
      from: { path: "^apps/web/src/" },
      to: { path: "^packages/skins/", dependencyTypes: ["local"] },
    },
    {
      name: "editor-allowed",
      severity: "error",
      comment: "The editor shows the session's text; it never keeps text of its own. Core for the track color; i18n, with its DOM bindings, for its copy.",
      from: { path: "^packages/editor/src", pathNot: notTest },
      to: {
        pathNot:
          "^packages/(core|language|session|commands|editor|i18n)/|node_modules/@codemirror/|node_modules/@lezer/(lr|common|highlight)/",
      },
    },
    {
      name: "light-allowed",
      severity: "error",
      comment: "The light engine follows scheduled events; it never decides when something plays.",
      from: { path: "^packages/light/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|scene|session|light)/" },
    },
    {
      name: "light-not-export",
      severity: "error",
      comment: "The brand zones reach the stage from the composition root; the light never imports the export.",
      from: { path: "^packages/light/src" },
      to: { path: "^packages/export/" },
    },
    {
      name: "share-allowed",
      severity: "error",
      comment: "Share carries the text out and back; it cannot read it (no language) and returns only strings.",
      from: { path: "^packages/share/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|session|share)/" },
    },
    {
      name: "export-allowed",
      severity: "error",
      comment: "Export renders offline with the DSP host and the stage; the transport arrives as a factory.",
      from: { path: "^packages/export/src", pathNot: notTest },
      to: { pathNot: "^packages/(core|scene|session|audio|light|export)/|node_modules/mediabunny/" },
    },
    {
      name: "export-audio-subpaths",
      severity: "error",
      comment: "Export uses the DSP host and the protocol only.",
      from: { path: "^packages/export/src", pathNot: notTest },
      to: { path: "^packages/audio/src/(main|worker|unlock|preload|worklet/processor)" },
    },
    {
      name: "export-light-offline-only",
      severity: "error",
      comment:
        "Export reaches the stage through @untzel/light/offline only: the main entry pulls the live stage and its clock, DOM types the worker's WebWorker lib does not have.",
      from: { path: "^packages/export/src", pathNot: notTest },
      to: { path: "^packages/light/src/(index|stage/stage|stage/clock)\\.ts$" },
    },
    {
      name: "docs-site-allowed",
      severity: "error",
      comment: "The docs pages, frame copy and client read the packages they document and the i18n core and DOM adapter.",
      from: { path: "^apps/docs/src", pathNot: notTest },
      to: { pathNot: "^apps/docs/src/|^packages/(core|language|i18n|skin-contract)/" },
    },
    {
      name: "docs-generator-allowed",
      severity: "error",
      comment:
        "The docs generator reads packages only through their index and, from apps/web, only the build's instrument list, registry, the catalog of instrument descriptions and package.json (the template folder is read from disk through @untzel/templates): the docs use the build's own lists, never a third copy.",
      from: { path: "^tools/docs/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: [
          "^tools/docs/src/",
          "^packages/(core|language|i18n|skins/booth|skin-contract|templates|commands)/src/index\\.ts$",
          "^packages/(skins/booth|commands)/src/copy/portuguese\\.ts$",
          "^apps/docs/src/",
          "^packages/instrument-index/src/index\\.ts$",
          "^apps/web/src/strings/instruments(\\.pt-BR)?\\.ts$",
          "^apps/web/package\\.json$",
          "node_modules/(markdown-it|vite|dependency-cruiser)/",
        ],
      },
    },
    {
      name: "i18n-check-allowed",
      severity: "error",
      comment: "pnpm i18n:check reads the English catalogs and their translation files, nothing else.",
      from: { path: "^tools/i18n/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: [
          "^tools/i18n/src/",
          "^packages/i18n/src/(?!dom/)",
          // Every catalog of every skin, never the live catalog (copy.ts) or the ./pt-BR entry: a
          // new skin adds its catalogs to tools/i18n/src/catalogs.ts, not to this rule.
          "^packages/skins/[^/]+/src/copy/(?!copy\\.ts$|portuguese\\.ts$)[a-z-]+(\\.pt-BR)?\\.ts$",
          "^packages/(editor|commands)/src/copy/strings(\\.pt-BR)?\\.ts$",
          "^packages/language/src/copy/messages(\\.pt-BR)?\\.ts$",
          "^apps/web/src/strings/(en|pt-BR|instruments|instruments\\.pt-BR)\\.ts$",
          "^apps/docs/src/",
          "node_modules/vite/",
        ],
      },
    },
    {
      name: "ui-preview-allowed",
      severity: "error",
      comment:
        "The screen preview mounts the skin over a fake session: the domain, the view model, the editor, the light, the i18n core, the contract and the skin it previews.",
      from: { path: "^apps/ui-preview/src" },
      to: {
        pathNot:
          "^apps/ui-preview/src/|^packages/(core|language|scene|session|editor|light|skin-contract|skins/booth)/|^packages/presentation/src/view-model/|^packages/i18n/src/(?!dom/)",
      },
    },
    {
      name: "sim-allowed",
      severity: "error",
      comment:
        "The simulator plays the real engine in Node: the domain, the DSP host and the protocol, the WAV writer, the templates, the instrument manifests, the Opus decoder and Node; for pnpm sim --take, the take and its replay, the worker's transport host, and the export's plan and sound renderers.",
      from: { path: "^tools/sim/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: [
          "^tools/sim/src/",
          "^packages/(core|language|transport|session|templates|take)/",
          "^packages/audio/src/(protocol/|worklet/dsp-host\\.ts$|main/|worker/)",
          "^packages/export/src/audio/(wav|render-wav|render-audio)\\.ts$",
          "^packages/export/src/(plan|take-plan)\\.ts$",
          "^packages/instrument-index/src/index\\.ts$",
          "node_modules/opus-decoder/",
        ],
      },
    },
    {
      name: "sim-session-types-only",
      severity: "error",
      comment: "The simulator drives the transport itself: it reads the session's types only, and the sounding recipe a take replays (./sounding).",
      from: { path: "^tools/sim/src", pathNot: notTest },
      to: { path: "^packages/session/", pathNot: "^packages/session/src/sounding-program\\.ts$", dependencyTypesNot: ["type-only"] },
    },
    {
      name: "release-tool-allowed",
      severity: "error",
      comment: "The release packager reads build output from disk: Node modules and its own src only.",
      from: { path: "^tools/release/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: ["^tools/release/src/"],
      },
    },
    {
      name: "changelog-tool-allowed",
      severity: "error",
      comment: "The changelog tool reads entry files and Git: Node modules and its own src only.",
      from: { path: "^tools/changelog/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: ["^tools/changelog/src/"],
      },
    },
    {
      name: "demo-tool-allowed",
      severity: "error",
      comment:
        "pnpm demo: the language, the session, the skin contract's intents, the booth's words through its entry (the recorder finds the booth's controls by their accessible names), the take, the simulator, Playwright, Vite's preview server, the app's CSP and Node.",
      from: { path: "^tools/demo/src", pathNot: notTest },
      to: {
        dependencyTypesNot: ["core"],
        pathNot: [
          "^tools/(demo|sim)/",
          "^tools/harness/app-content-security-policy\\.mjs$",
          "^packages/(core|language|session|skin-contract|take)/",
          "^packages/skins/booth/src/index\\.ts$",
          "node_modules/(@playwright/test|playwright|playwright-core|vite)/",
        ],
      },
    },
    {
      name: "nothing-imports-apps",
      severity: "error",
      from: { path: "^(packages|instruments)/" },
      to: { path: "^apps/" },
    },
    {
      name: "nothing-imports-tools",
      severity: "error",
      comment: "tools/ (the simulator, the harness) serve development; no product package depends on them.",
      from: { path: "^(packages|instruments)/" },
      to: { path: "^tools/" },
    },
    {
      name: "testing-only-in-tests",
      severity: "error",
      comment:
        "A package's src/testing/ (its ./testing entry) serves tests only: unit tests, the browser suites and apps/web/src/testing/, which the test build's hooks load (import.meta.env.MODE).",
      from: { pathNot: ["\\.(test|browser)\\.ts$", "^apps/web/tests/", "^packages/(skins/)?[^/]+/src/testing/", "^apps/web/src/testing/"] },
      to: { path: "^packages/(skins/)?[^/]+/src/testing/" },
    },
    {
      name: "no-node-builtins-in-src",
      severity: "error",
      comment: "tools/ are Node programs (the simulator); they may use node: modules.",
      from: { path: "/src/", pathNot: [notTest, "^tools/"] },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-unresolvable",
      severity: "error",
      comment:
        "Vite asset imports (?url, ?worker, ?worker&url, ?raw, ?inline) are not resolvable here; the build job covers them.",
      from: {},
      to: { couldNotResolve: true, pathNot: assetQuery },
    },
    {
      name: "no-undeclared-deps",
      severity: "error",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    parser: "swc",
    doNotFollow: { path: "node_modules" },
    // Build output, the test build (dist-test) included: its chunks import each other.
    exclude: { path: "(^|/)(node_modules|dist|dist-test|\\.cache|target)/" },
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "default"],
      extensions: [".ts", ".js"],
    },
  },
};
