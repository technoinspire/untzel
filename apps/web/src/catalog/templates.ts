// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template library of the page: every templates/<style>/<project>.untzel, every
// templates/<style>/style.json and the templates at the root, read by Vite's glob and
// handed to the catalog (@untzel/templates). Adding a style is adding a folder with a
// style.json; adding a project is adding one file. Nothing here lists them.

import { discoverTemplates, type TemplateCatalog, type TemplateFile } from "@untzel/templates";

const TEXTS = import.meta.glob<string>("./templates/**/*.untzel", { query: "?raw", import: "default", eager: false, base: "../" });
const STYLES = import.meta.glob<string>("./templates/*/style.json", { query: "?raw", import: "default", eager: true, base: "../" });
const ROOT = "./templates/";

let catalog: Promise<TemplateCatalog> | null = null;

/** Every template, read once; a file the catalog leaves out is reported on the console. */
export function templateCatalog(): Promise<TemplateCatalog> {
  catalog ??= Promise.all(Object.entries(TEXTS).map(async ([path, load]) => [path.slice(ROOT.length), await load()] as const)).then((texts) => {
    const styles = Object.entries(STYLES).map(([path, text]) => [path.slice(ROOT.length), text] as const);
    const discovered = discoverTemplates(Object.fromEntries([...texts, ...styles]));
    for (const problem of discovered.problems) console.error(`Untzel: template library: ${problem}`);
    return discovered;
  });
  return catalog;
}

/** A project or a template at the root, by id. */
export function templateById(library: TemplateCatalog, id: string): TemplateFile | null {
  return library.projects.find((project) => project.id === id) ?? library.starters.find((starter) => starter.id === id) ?? null;
}
