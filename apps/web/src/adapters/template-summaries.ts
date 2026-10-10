// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The tempo and key on each template card, read from the analyzed program, never from a
// header. Runs in the engine's code, which already carries the language.

import type { TemplateSummaryView } from "@untzel/presentation/view-model";
import { toNumber } from "@untzel/core";
import type { AnalyzeResult } from "@untzel/language";
import type { TemplateFile } from "@untzel/templates";

/** A template that does not analyze gets no summary: its card shows the name only. */
export function templateSummaries(templates: readonly TemplateFile[], analyze: (source: string) => AnalyzeResult): Record<string, TemplateSummaryView> {
  const summaries: Record<string, TemplateSummaryView> = {};
  for (const template of templates) {
    const result = analyze(template.text);
    if (result.ok) summaries[template.id] = { bpm: toNumber(result.program.tempo), key: result.program.key };
  }
  return summaries;
}
