// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every regular file under a directory, as sorted POSIX paths relative to it. A symbolic
// link or any other kind of entry stops the release: the archive carries files only.
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { compareByPath } from "./path-order";

export interface CollectedFile {
  /** POSIX path relative to the collected directory. */
  readonly path: string;
  readonly absolutePath: string;
}

export interface CollectOptions {
  /** A nested directory (POSIX path relative to the root) left out with everything in it. */
  readonly exclude?: string;
}

function walk(root: string, relative: string, exclude: string | undefined, found: CollectedFile[]): void {
  const directory = relative === "" ? root : join(root, relative);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (path !== exclude) walk(root, path, exclude, found);
    } else if (entry.isFile()) {
      found.push({ path, absolutePath: join(root, ...path.split("/")) });
    } else {
      const kind = entry.isSymbolicLink() ? "a symbolic link" : "not a regular file";
      throw new Error(`${join(root, path)} is ${kind}: the release archive carries regular files only`);
    }
  }
}

export function collectFiles(root: string, options: CollectOptions = {}): CollectedFile[] {
  const stats = lstatSync(root, { throwIfNoEntry: false });
  if (stats === undefined || !stats.isDirectory()) throw new Error(`${root} is not a directory`);
  const found: CollectedFile[] = [];
  walk(root, "", options.exclude, found);
  return found.sort(compareByPath);
}
