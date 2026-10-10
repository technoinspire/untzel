// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { TemplateCatalog } from "@untzel/templates";
import type { TemplateChoice } from "../waiting/waiting-stage";

/**
 * What the picker opens on: a ?template= the library has (or `extra`, the phase 1
 * fixture of the tests), else the remembered choice when its template still exists,
 * else the first-touch template.
 */
export function initialChoice(catalog: TemplateCatalog, requested: string | null, remembered: TemplateChoice | null, extra: string): TemplateChoice {
  const exists = (id: string): boolean => id === extra || catalog.projects.some((project) => project.id === id) || catalog.starters.some((starter) => starter.id === id);
  if (requested !== null && exists(requested)) return { template: requested, openStyle: null };
  if (remembered !== null && exists(remembered.template)) return remembered;
  return { template: catalog.firstTouch ?? "", openStyle: null };
}
