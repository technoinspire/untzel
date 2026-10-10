// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template library, discovered from its files:
//   <style>/style.json          a style tab: { "label", "order" }
//   <style>/<project>.untzel    a project of that style, with its header
//   <name>.untzel               a template outside every style (the blank one)
// Pure: the caller reads the folder (Vite's glob on the page, node:fs in the simulator)
// and passes the texts by path. Nothing here lists a template.

import { parseStyleFile } from "./style-file";
import { parseTemplateHeader } from "./template-header";

export interface TemplateStyle {
  /** The folder name, for example "house". */
  readonly id: string;
  readonly label: string;
  readonly order: number;
}

export interface TemplateFile {
  /** "<style>/<project>" for a project, "<name>" at the root. */
  readonly id: string;
  readonly name: string;
  readonly order: number;
  readonly text: string;
}

export interface TemplateProject extends TemplateFile {
  readonly style: string;
}

export interface TemplateCatalog {
  /** Styles that have at least one project, in tab order. */
  readonly styles: readonly TemplateStyle[];
  /** Every project, by style order, then project order, then id. */
  readonly projects: readonly TemplateProject[];
  /** Templates at the root, outside every style, by order. */
  readonly starters: readonly TemplateFile[];
  /** The project marked `// default: true`; the first project when none is. */
  readonly firstTouch: string | null;
  /** Files left out or marks ignored, and why. */
  readonly problems: readonly string[];
}

const SEGMENT = /^[a-z0-9][a-z0-9-]*$/;
const TEMPLATE_EXTENSION = ".untzel";
const STYLE_FILE = "style.json";

/** "house/disco-lights.untzel" → "house/disco-lights"; "blank.untzel" → "blank". */
export function templateIdOf(path: string): string {
  return path.replace(/^\.\//, "").slice(0, -TEMPLATE_EXTENSION.length);
}

/** `files` maps paths relative to the templates folder to their texts. */
export function discoverTemplates(files: Readonly<Record<string, string>>): TemplateCatalog {
  const problems: string[] = [];
  const paths = Object.keys(files).map((path) => path.replace(/^\.\//, "")).sort();
  const text = (path: string): string => files[path] ?? files[`./${path}`] ?? "";
  const styles = readStyles(paths, text, problems);
  const projects: TemplateProject[] = [];
  const starters: TemplateFile[] = [];
  const defaults: string[] = [];
  for (const path of paths.filter((candidate) => candidate.endsWith(TEMPLATE_EXTENSION))) {
    const placed = placeTemplate(path, text(path), styles, problems);
    if (placed === null) continue;
    if (placed.style === null) starters.push(placed.file);
    else projects.push({ ...placed.file, style: placed.style });
    if (placed.isDefault) defaults.push(placed.file.id);
  }
  const styleOrder = (id: string): number => styles.get(id)?.order ?? Infinity;
  projects.sort((a, b) => styleOrder(a.style) - styleOrder(b.style) || a.order - b.order || compareIds(a.id, b.id));
  starters.sort((a, b) => a.order - b.order || compareIds(a.id, b.id));
  return {
    styles: [...styles.values()].filter((style) => projects.some((project) => project.style === style.id)).sort((a, b) => a.order - b.order || compareIds(a.id, b.id)),
    projects,
    starters,
    firstTouch: firstTouchOf(projects, defaults, problems),
    problems,
  };
}

function readStyles(paths: readonly string[], text: (path: string) => string, problems: string[]): Map<string, TemplateStyle> {
  const styles = new Map<string, TemplateStyle>();
  for (const path of paths.filter((candidate) => candidate.endsWith(`/${STYLE_FILE}`))) {
    const id = path.slice(0, -STYLE_FILE.length - 1);
    const style = parseStyleFile(text(path));
    if (!SEGMENT.test(id)) problems.push(`${path}: the folder name is not lowercase letters, digits and "-"`);
    else if (style === null) problems.push(`${path}: needs { "label": "<tab>", "order": <1 or more> }`);
    else styles.set(id, { id, ...style });
  }
  return styles;
}

interface PlacedTemplate {
  readonly file: TemplateFile;
  /** null at the root. */
  readonly style: string | null;
  readonly isDefault: boolean;
}

function placeTemplate(path: string, text: string, styles: ReadonlyMap<string, TemplateStyle>, problems: string[]): PlacedTemplate | null {
  const id = templateIdOf(path);
  const segments = id.split("/");
  if (segments.length > 2 || !segments.every((segment) => SEGMENT.test(segment))) {
    problems.push(`${path}: a template is <style>/<project>.untzel or <name>.untzel, in lowercase letters, digits and "-"`);
    return null;
  }
  const style = segments.length === 2 ? (segments[0] ?? null) : null;
  if (style !== null && !styles.has(style)) {
    problems.push(`${path}: the folder ${style}/ has no valid ${STYLE_FILE}`);
    return null;
  }
  const header = parseTemplateHeader(text);
  if (header === null) {
    problems.push(`${path}: has no "// template:" and "// order:" header`);
    return null;
  }
  if (header.isDefault && style === null) problems.push(`${path}: "// default: true" is for a project in a style folder; ignored`);
  return { file: { id, name: header.name, order: header.order, text }, style, isDefault: header.isDefault && style !== null };
}

function firstTouchOf(projects: readonly TemplateProject[], defaults: readonly string[], problems: string[]): string | null {
  const marked = projects.filter((project) => defaults.includes(project.id));
  if (marked.length > 1) problems.push(`more than one "// default: true" (${marked.map((project) => project.id).join(", ")}); ${marked[0]?.id ?? ""} plays first`);
  return marked[0]?.id ?? projects[0]?.id ?? null;
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
