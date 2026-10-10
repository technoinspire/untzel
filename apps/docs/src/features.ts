// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Designed features and the probe that tells, at build time, whether this build has them.
// The docs never write "available" or "planned" by hand: the generator evaluates the
// probe. A wrong entry name
// keeps a feature "planned": it never promises too much.

export type FeatureId =
  | "chords"
  | "instrument-library"
  | "presets"
  | "more-templates"
  | "loop-length"
  | "share-link"
  | "saved-session"
  | "remix"
  | "export"
  | "recorded-voices"
  | "export-4k"
  | "composer-terminal"
  | "play-range"
  | "projects"
  | "song-title"
  | "recorded-instruments";

export type Probe =
  /** Some manifest of the registry has this kind. */
  | { readonly kind: "manifest-kind"; readonly value: string }
  /** The registry has an instrument with this name. */
  | { readonly kind: "instrument"; readonly name: string }
  /** Some raw instruments/<name>/manifest.json has this field (parseManifest drops unknown fields). */
  | { readonly kind: "raw-manifest-field"; readonly field: string }
  /** Some manifest has a parameter with this name that offers this choice. */
  | { readonly kind: "raw-manifest-choice"; readonly parameter: string; readonly choice: string }
  /** The raw manifest of this instrument has a parameter with this name that offers this choice. */
  | { readonly kind: "instrument-choice"; readonly instrument: string; readonly parameter: string; readonly choice: string }
  /** The build's template library has this template id ("<style>/<project>"). */
  | { readonly kind: "template"; readonly id: string }
  /** @untzel/core exports this name. */
  | { readonly kind: "core-export"; readonly name: string }
  /** apps/web depends on the package and a module reachable from main.ts imports the entry from it. */
  | { readonly kind: "app-import"; readonly packageName: string; readonly entry: string };

export interface Feature {
  readonly id: FeatureId;
  readonly probe: Probe;
}

export const FEATURES: readonly Feature[] = [
  { id: "chords", probe: { kind: "manifest-kind", value: "chord" } },
  { id: "instrument-library", probe: { kind: "instrument", name: "piano" } },
  { id: "presets", probe: { kind: "raw-manifest-field", field: "presets" } },
  { id: "more-templates", probe: { kind: "template", id: "trance/eternal-horizon" } },
  { id: "loop-length", probe: { kind: "core-export", name: "MAX_LOOP_BARS" } },
  // Entry names: what apps/web imports from packages/share and reads off packages/export,
  // which it loads on demand. The link is built by the
  // source store, which wraps encodeLink.
  { id: "share-link", probe: { kind: "app-import", packageName: "@untzel/share", entry: "createSourceStore" } },
  // The last session is the most recent project of the library, stored in
  // IndexedDB; LocalSessionStore is only read once, to move the old session in.
  { id: "saved-session", probe: { kind: "app-import", packageName: "@untzel/share", entry: "openProjectStore" } },
  { id: "remix", probe: { kind: "app-import", packageName: "@untzel/share", entry: "decodeFragment" } },
  { id: "export", probe: { kind: "app-import", packageName: "@untzel/export", entry: "ExportClient" } },
  { id: "recorded-voices", probe: { kind: "raw-manifest-choice", parameter: "source", choice: "samples" } },
  { id: "export-4k", probe: { kind: "app-import", packageName: "@untzel/export", entry: "chooseTiers" } },
  // The Code panel's command line: the editor chunk builds a Composer.
  { id: "composer-terminal", probe: { kind: "app-import", packageName: "@untzel/commands", entry: "Composer" } },
  // The play range: the session's use cases the controls port builds.
  { id: "play-range", probe: { kind: "app-import", packageName: "@untzel/session", entry: "PlayRanges" } },
  // The project library, from @untzel/session/projects.
  { id: "projects", probe: { kind: "app-import", packageName: "@untzel/session", entry: "ProjectLibrary" } },
  // The title line: renaming the song in the app goes through TitleEdits.
  { id: "song-title", probe: { kind: "app-import", packageName: "@untzel/session", entry: "TitleEdits" } },
  // Recorded instruments beyond the voices: the piano is the first of them.
  { id: "recorded-instruments", probe: { kind: "instrument-choice", instrument: "piano", parameter: "source", choice: "samples" } },
  // Record: the page loads @untzel/take on the first Record and builds a TakeRecorder.
];

/**
 * Examples that need a feature: with the probe false they are neither shown nor analyzed;
 * with it true they must analyze clean. Empty today: no published example needs one.
 */
export const EXAMPLE_REQUIREMENTS: Readonly<Record<string, FeatureId>> = {};
