// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The project library's controls bound to this browser: the IndexedDB
// library, each project's summary read by the language, and Save file through the
// browser's save dialog or a download. The App only hands over the registry and the page.
import { livePhrases as phrases } from "@untzel/skin";
import { toNumber, type InstrumentRegistry } from "@untzel/core";
import { analyze } from "@untzel/language";
import { UNTZEL_EXTENSION, UNTZEL_MIME, saveBlob, untzelFileText } from "@untzel/share";
import { ProjectControls, type ProjectPage } from "./project-controls";
import { openProjectLibrary } from "./project-library";

export interface BrowserProjectOptions {
  readonly registry: InstrumentRegistry;
  readonly page: ProjectPage;
  readonly storage: Storage | null;
}

export function browserProjectControls(options: BrowserProjectOptions): ProjectControls {
  return new ProjectControls({
    library: openProjectLibrary(options.storage),
    page: options.page,
    describe: (source) => projectSummary(source, options.registry),
    saveFile: (name, record) => {
      const blob = new Blob([untzelFileText(record.source, record.playback?.mode ?? null, record.playback?.range ?? null)], { type: UNTZEL_MIME });
      void saveBlob(blob, name, { description: "Untzel song", accept: { [UNTZEL_MIME]: [UNTZEL_EXTENSION] } });
    },
    now: () => new Date(),
  });
}

/** "124 BPM · 6 tracks" for the Projects sheet; null when the text does not analyze. */
export function projectSummary(source: string, registry: InstrumentRegistry): string | null {
  const result = analyze(source, registry);
  if (!result.ok) return null;
  return phrases.projectSummary(Math.round(toNumber(result.program.tempo)), result.program.tracks.length);
}
