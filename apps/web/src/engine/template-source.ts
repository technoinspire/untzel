// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The text a template plays, with the dev and test builds' stress and fixture texts.
// Part of the boot chunk.
import type { InstrumentManifest } from "@untzel/core";
import type { PageFlags } from "@untzel/ui-preview/page-flags";
import { PHASE1_FIXTURE } from "../catalog/template-names";
import { templateById, templateCatalog } from "../catalog/templates";

export async function templateSource(template: string, instruments: readonly InstrumentManifest[], flags: PageFlags): Promise<string> {
  // Literal after Vite's replacement: production drops the stress generator and its import.
  const dev = import.meta.env.DEV || import.meta.env.MODE === "test";
  const stress = dev ? flags.stress : null;
  if (stress !== null) {
    const { stressSource } = await import("@untzel/sim/stress");
    return stressSource(instruments, stress);
  }
  const stressEngine = dev ? flags.stressEngine : null;
  if (stressEngine !== null) {
    const { ENGINE_TRACKS, instrumentStressSource } = await import("@untzel/sim/stress");
    const instrument = instruments.find((entry) => entry.name === stressEngine) ?? instruments[0];
    if (instrument !== undefined) return instrumentStressSource(instrument, ENGINE_TRACKS);
  }
  if ((import.meta.env.DEV || import.meta.env.MODE === "test") && template === PHASE1_FIXTURE) {
    return (await import("@untzel/sim/fixtures/phase1-onboard.untzel?raw")).default;
  }
  const catalog = await templateCatalog();
  return (templateById(catalog, template) ?? templateById(catalog, catalog.firstTouch ?? ""))?.text ?? "";
}
