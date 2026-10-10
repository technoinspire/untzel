// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words of the library that come from the instruments: each manifest's description and
// the description of each of its sounds. The English source is the manifests themselves,
// never a copy: this catalog is read from them, keyed "<instrument>" and
// "<instrument>/<sound>". Translations live next to it (instruments.pt-BR.ts).
import { parseManifest, type InstrumentManifest } from "@untzel/core";
import { manifests } from "@untzel/instrument-index";
import { soundKey } from "./sound-key";

export { soundKey };

function entriesOf(manifest: InstrumentManifest): readonly (readonly [string, string])[] {
  return [
    [manifest.name, manifest.description],
    ...manifest.presets.map((preset) => [soundKey(manifest.name, preset.name), preset.description] as const),
  ];
}

/** Invalid manifests are left out here; buildRegistry (@untzel/instrument-index) rejects them for the build. */
export const instrumentText: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    manifests.flatMap((json) => {
      const result = parseManifest(json);
      return result.ok ? entriesOf(result.manifest) : [];
    }),
  ),
);
