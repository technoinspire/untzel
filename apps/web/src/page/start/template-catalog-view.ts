// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template library as the picker shows it: styles and projects, without the texts.
// The tempo and key come later, from the engine's code (adapters/template-summaries.ts):
// the initial JS never carries the language parser.

import type { TemplateCatalogView, TemplateSummaryView } from "@untzel/presentation/view-model";
import type { TemplateCatalog } from "@untzel/templates";

/** The Blank project's file: apps/web/src/templates/blank.untzel. */
export const BLANK_ID = "blank";

export function templateCatalogView(catalog: TemplateCatalog, summaries: Readonly<Record<string, TemplateSummaryView>> = {}): TemplateCatalogView {
  const blank = catalog.starters.find((starter) => starter.id === BLANK_ID) ?? null;
  return {
    blank: blank === null ? null : { id: blank.id, style: "", name: blank.name, summary: summaries[blank.id] ?? null },
    styles: catalog.styles.map((style) => ({ id: style.id, label: style.label })),
    projects: catalog.projects.map((project) => ({ id: project.id, style: project.style, name: project.name, summary: summaries[project.id] ?? null })),
  };
}
