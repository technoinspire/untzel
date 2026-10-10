// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Everything the docs are generated from, read once: the build's registry and templates,
// the pages, the examples and the grammar. Nothing here is a copy; each value is read from
// the file or module the app itself uses.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { PAGE_IDS, type PageId } from "../../../../apps/docs/src/pages";
import { buildRegistry, manifests, type BuiltRegistry } from "@untzel/instrument-index";
import { discoverTemplates } from "@untzel/templates";

export interface SourceFile {
  /** Path relative to the repository, for messages. */
  readonly file: string;
  readonly text: string;
}

export interface Template {
  /** "<style>/<project>" for a project, "<name>" at the root (the blank one). */
  readonly id: string;
  /** The name of its header, as the template card shows it. */
  readonly name: string;
  /** The style tab's label; null at the root. */
  readonly style: string | null;
  readonly text: string;
}

/** One entry of credits.json: third-party material and the credit its license asks for. */
export interface Credit {
  readonly id: string;
  readonly title: string;
  readonly authors: readonly string[];
  /** Null for a sample library without named performers. */
  readonly performers: string | null;
  readonly license: { readonly id: string; readonly name: string; readonly url: string };
  readonly url: string;
  readonly doi: string | null;
  /** The credit line the license or the authors ask for; null where none is asked (CC0). */
  readonly citation: string | null;
  readonly usedBy: readonly string[];
  readonly changes: string;
  /** The bundled files the credit covers, relative to the repository. */
  readonly files: readonly string[];
}

export interface PageSources {
  readonly en: SourceFile;
  readonly ptBR: SourceFile | null;
}

export interface DocsSources {
  readonly repo: string;
  readonly built: BuiltRegistry;
  /** The manifests of the build as JSON, before parseManifest drops unknown fields. */
  readonly rawManifests: readonly unknown[];
  /** Every project in tab order, then the templates at the root. */
  readonly templates: readonly Template[];
  /** The id of the template the first tap plays. */
  readonly firstTouch: string | null;
  /** "first-loop", "snippets/<id>", "errors/<CODE>": text without the trailing newline. */
  readonly examples: ReadonlyMap<string, SourceFile>;
  readonly grammar: SourceFile;
  /** credits.json: the bundled third-party material, in its order. */
  readonly credits: readonly Credit[];
  readonly pages: ReadonlyMap<PageId, PageSources>;
  /** Dependencies of apps/web/package.json. */
  readonly webDependencies: ReadonlySet<string>;
}

function read(repo: string, path: string): SourceFile {
  return { file: relative(repo, path), text: readFileSync(path, "utf8") };
}

function trimFinalNewline(text: string): string {
  return text.replace(/\r?\n$/, "");
}

function readExamples(repo: string): ReadonlyMap<string, SourceFile> {
  const root = join(repo, "apps/docs/examples");
  const examples = new Map<string, SourceFile>();
  const walk = (folder: string, prefix: string): void => {
    for (const entry of readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory()) walk(join(folder, entry.name), `${prefix}${entry.name}/`);
      else if (entry.name.endsWith(".untzel")) {
        const file = read(repo, join(folder, entry.name));
        examples.set(`${prefix}${entry.name.replace(/\.untzel$/, "")}`, { ...file, text: trimFinalNewline(file.text) });
      }
    }
  };
  walk(root, "");
  return examples;
}

const TEMPLATE_DIR = "apps/web/src/templates";

/** The files of the templates folder and its style folders, by path relative to it. */
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

/** The library through the same catalog the picker uses (@untzel/templates). */
function readTemplates(repo: string): Pick<DocsSources, "templates" | "firstTouch"> {
  const catalog = discoverTemplates(templateTexts(join(repo, TEMPLATE_DIR)));
  if (catalog.problems.length > 0) throw new Error(`${TEMPLATE_DIR}: ${catalog.problems.join("; ")}`);
  const labels = new Map(catalog.styles.map((style) => [style.id, style.label]));
  const projects = catalog.projects.map((project) => ({ id: project.id, name: project.name, style: labels.get(project.style) ?? project.style, text: trimFinalNewline(project.text) }));
  const starters = catalog.starters.map((starter) => ({ id: starter.id, name: starter.name, style: null, text: trimFinalNewline(starter.text) }));
  return { templates: [...projects, ...starters], firstTouch: catalog.firstTouch };
}

const CREDIT_TEXT_FIELDS = ["id", "title", "url", "changes"] as const;
const CREDIT_OPTIONAL_TEXT_FIELDS = ["performers", "doi", "citation"] as const;

/** credits.json, checked field by field: a malformed credit fails the build, never a page. */
function readCredits(repo: string): readonly Credit[] {
  const parsed = JSON.parse(readFileSync(join(repo, "credits.json"), "utf8")) as { readonly credits?: unknown };
  if (!Array.isArray(parsed.credits)) throw new Error("credits.json: \"credits\" is not a list");
  return parsed.credits.map((entry: Record<string, unknown>, index: number) => {
    const where = `credits.json: credit ${index + 1}`;
    for (const field of CREDIT_TEXT_FIELDS) if (typeof entry[field] !== "string") throw new Error(`${where}: "${field}" is not a text`);
    for (const field of CREDIT_OPTIONAL_TEXT_FIELDS) if (entry[field] !== null && typeof entry[field] !== "string") throw new Error(`${where}: "${field}" is neither a text nor null`);
    for (const field of ["authors", "usedBy", "files"]) if (!Array.isArray(entry[field])) throw new Error(`${where}: "${field}" is not a list`);
    const license = entry["license"] as Record<string, unknown> | undefined;
    if (typeof license?.["name"] !== "string" || typeof license["url"] !== "string") throw new Error(`${where}: "license" needs a name and a url`);
    return entry as unknown as Credit;
  });
}

function readPages(repo: string): ReadonlyMap<PageId, PageSources> {
  const content = join(repo, "apps/docs/content");
  return new Map(
    PAGE_IDS.map((id) => {
      const english = join(content, `${id}.md`);
      if (!existsSync(english)) throw new Error(`${relative(repo, english)}: the English source of page "${id}" is missing`);
      const translated = join(content, `${id}.pt-BR.md`);
      return [id, { en: read(repo, english), ptBR: existsSync(translated) ? read(repo, translated) : null }] as const;
    }),
  );
}

export function loadSources(repo: string): DocsSources {
  const webPackage = JSON.parse(readFileSync(join(repo, "apps/web/package.json"), "utf8")) as {
    dependencies?: Record<string, string>;
  };
  return {
    repo,
    built: buildRegistry(),
    rawManifests: manifests,
    ...readTemplates(repo),
    examples: readExamples(repo),
    grammar: read(repo, join(repo, "packages/language/src/untzel.grammar")),
    credits: readCredits(repo),
    pages: readPages(repo),
    webDependencies: new Set(Object.keys(webPackage.dependencies ?? {})),
  };
}
