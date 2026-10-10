// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template library read from disk, through the same catalog the page uses
// (@untzel/templates): `pnpm sim house/disco-lights`, the golden files and the Node tests
// all see the tree the picker sees.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { discoverTemplates, type TemplateCatalog, type TemplateFile } from "@untzel/templates";

export const TEMPLATE_DIR = "apps/web/src/templates";

/** Every file of the templates folder and its style folders, by path relative to it. */
function templateTexts(root: string): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile()) texts[entry.name] = readFileSync(join(root, entry.name), "utf8");
    if (!entry.isDirectory()) continue;
    for (const child of readdirSync(join(root, entry.name), { withFileTypes: true })) {
      if (child.isFile()) texts[`${entry.name}/${child.name}`] = readFileSync(join(root, entry.name, child.name), "utf8");
    }
  }
  return texts;
}

export function readTemplateTree(repo: string): TemplateCatalog {
  return discoverTemplates(templateTexts(join(repo, TEMPLATE_DIR)));
}

/** Every project, then every template at the root. */
export function templateFiles(catalog: TemplateCatalog): readonly TemplateFile[] {
  return [...catalog.projects, ...catalog.starters];
}

/** The first-touch template (`// default: true`); throws when the library has none. */
export function firstTouchTemplate(catalog: TemplateCatalog): TemplateFile {
  const found = catalog.projects.find((project) => project.id === catalog.firstTouch);
  if (found === undefined) throw new Error("the template library has no project");
  return found;
}
