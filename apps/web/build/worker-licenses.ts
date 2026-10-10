// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Vite's build.license writes the license notices of the main bundle only: it skips worker
// builds, so a library that only a worker bundles (mediabunny, in the export worker) would
// ship without its notice. The worker side of this plugin records the packages of every
// worker bundle; the main side adds the ones the license file lacks, in Vite's own Markdown
// shape, after Vite has written it (THIRD_PARTY.md, "Bundled libraries").
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/** A package as the license file names it: one section per name and version. */
export interface BundledPackage {
  readonly name: string;
  readonly version: string;
  /** The SPDX identifier from package.json; null when the package declares none. */
  readonly identifier: string | null;
  /** The text of the package's LICENSE, LICENCE or COPYING file; null without one. */
  readonly text: string | null;
}

/** What this reads of a Rolldown output file. */
interface OutputFile {
  readonly type: "chunk" | "asset";
  readonly moduleIds?: readonly string[];
  source?: string | Uint8Array;
}

const LICENSE_FILE = [/^license/i, /^licence/i, /^copying/i];

/** The root folder of the npm package a module belongs to, or null outside node_modules. */
export function packageRootOf(moduleId: string): string | null {
  if (moduleId.startsWith("\0")) return null;
  const path = moduleId.replaceAll("\\", "/");
  const marker = path.lastIndexOf("/node_modules/");
  if (marker < 0) return null;
  const start = marker + "/node_modules/".length;
  const segments = path.slice(start).split("/");
  const length = segments[0]?.startsWith("@") === true ? 2 : 1;
  if (segments.length <= length) return null;
  return path.slice(0, start) + segments.slice(0, length).join("/");
}

/** The heading Vite writes for a package, which also tells whether a section exists. */
export function licenseHeading(entry: BundledPackage): string {
  const identifier = entry.identifier === null ? "" : ` (${entry.identifier})`;
  return `## ${entry.name} - ${entry.version}${identifier}`;
}

/** The license file with a section for every package it does not name yet, in name order. */
export function withPackages(markdown: string, packages: readonly BundledPackage[]): string {
  const missing = packages
    .filter((entry) => !markdown.includes(`\n## ${entry.name} - ${entry.version}`))
    .sort((a, b) => a.name.localeCompare(b.name));
  return missing.reduce((text, entry) => `${text}\n${licenseHeading(entry)}\n${entry.text === null ? "" : `\n${entry.text}\n`}`, markdown);
}

function readPackage(root: string): BundledPackage | null {
  const data = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name?: string; version?: string; license?: string };
  if (data.name === undefined) return null;
  const licenseFile = readdirSync(root).find((file) => LICENSE_FILE.some((pattern) => pattern.test(file)));
  return {
    name: data.name,
    version: data.version ?? "0.0.0",
    identifier: data.license?.trim() ?? null,
    text: licenseFile === undefined ? null : readFileSync(join(root, licenseFile), "utf8").trim(),
  };
}

function collect(bundle: Readonly<Record<string, OutputFile>>, into: Map<string, BundledPackage>): void {
  for (const file of Object.values(bundle)) {
    for (const moduleId of file.moduleIds ?? []) {
      const root = packageRootOf(moduleId);
      if (root === null || into.has(root)) continue;
      const entry = readPackage(root);
      if (entry !== null) into.set(root, entry);
    }
  }
}

/** One collector shared by the main build and every worker build of the same run. */
export function workerLicenses(fileName: string): { readonly main: Plugin; readonly worker: () => Plugin } {
  const packages = new Map<string, BundledPackage>();
  return {
    worker: () => ({
      name: "untzel-worker-licenses:collect",
      generateBundle: (_, bundle) => collect(bundle as unknown as Record<string, OutputFile>, packages),
    }),
    main: {
      name: "untzel-worker-licenses:write",
      apply: "build",
      generateBundle: {
        // After vite:license, which emits the file this extends.
        order: "post",
        handler(_, bundle) {
          const file = (bundle as unknown as Record<string, OutputFile>)[fileName];
          if (file === undefined || file.type !== "asset" || typeof file.source !== "string") {
            this.error(`worker licenses: ${fileName} is not in the bundle; build.license must name it`);
          }
          file.source = withPackages(file.source, [...packages.values()]);
        },
      },
    },
  };
}
