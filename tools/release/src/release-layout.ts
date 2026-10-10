// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What goes into the release archive and where: the app under app/, the public
// docs under docs/, and the license notices the CPAL requires next to the package at the root.
import { lstatSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { collectFiles } from "./collect-files";
import { compareByPath } from "./path-order";

export const NOTICE_FILES = ["LICENSE", "ATTRIBUTION.md", "TRADEMARKS.md"] as const;
// The site reads the changelog and the docs index from the package.
export const REQUIRED_PATHS = ["app/index.html", "app/changelog.json", "docs/index.html", "docs/pages.json"] as const;

export interface LayoutSources {
  /** The app build (apps/web/dist); a docs build nested in it is left out of app/. */
  readonly app: string;
  /** The public docs build (apps/web/dist/docs). */
  readonly docs: string;
  /** The repository root, where the license notices live. */
  readonly repo: string;
}

export interface LayoutEntry {
  /** Path inside the archive. */
  readonly path: string;
  readonly absolutePath: string;
}

/** The docs directory as a POSIX path inside the app build, when it is nested there. */
function nestedDirectory(parent: string, child: string): string | undefined {
  const path = relative(parent, child);
  if (path === "" || path.startsWith("..") || isAbsolute(path)) return undefined;
  return path.split(sep).join("/");
}

function noticeEntry(repo: string, name: string): LayoutEntry {
  const absolutePath = join(repo, name);
  const stats = lstatSync(absolutePath, { throwIfNoEntry: false });
  if (stats === undefined || !stats.isFile()) throw new Error(`${absolutePath} is missing: the license notices travel with every release`);
  return { path: name, absolutePath };
}

function checkLayout(entries: readonly LayoutEntry[]): void {
  const paths = new Set<string>();
  for (const entry of entries) {
    if (paths.has(entry.path)) throw new Error(`two files map to ${entry.path} in the release archive`);
    paths.add(entry.path);
  }
  for (const required of REQUIRED_PATHS) {
    if (!paths.has(required)) throw new Error(`${required} is missing: run pnpm build first`);
  }
}

export function releaseLayout(sources: LayoutSources): LayoutEntry[] {
  const exclude = nestedDirectory(sources.app, sources.docs);
  const app = collectFiles(sources.app, exclude === undefined ? {} : { exclude });
  const docs = collectFiles(sources.docs);
  const entries = [
    ...app.map((file) => ({ path: `app/${file.path}`, absolutePath: file.absolutePath })),
    ...docs.map((file) => ({ path: `docs/${file.path}`, absolutePath: file.absolutePath })),
    ...NOTICE_FILES.map((name) => noticeEntry(sources.repo, name)),
  ].sort(compareByPath);
  checkLayout(entries);
  return entries;
}
