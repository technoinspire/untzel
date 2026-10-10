// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Weight budgets of the docs, gzip level 9.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

export const BUDGETS = {
  pageHtml: 40 * 1024,
  css: 12 * 1024,
  script: 8 * 1024,
  searchIndex: 40 * 1024,
  llmsFull: 200 * 1024,
  /** 24 000 until the prompt gained SIGNAL_NOT_ALLOWED and NOTHING_TO_PLAY. */
  promptCharacters: 25_000,
} as const;

export interface Measure {
  readonly what: string;
  readonly bytes: number;
  readonly limit: number;
}

export function gzipped(root: string, file: string): number {
  return gzipSync(readFileSync(join(root, file)), { level: 9 }).length;
}

export function measureBudgets(root: string, files: readonly string[], prompt: string): readonly Measure[] {
  const sum = (pattern: RegExp): number => files.filter((file) => pattern.test(file)).reduce((total, file) => total + gzipped(root, file), 0);
  return [
    ...files.filter((file) => file.endsWith(".html")).map((file) => ({ what: file, bytes: gzipped(root, file), limit: BUDGETS.pageHtml })),
    { what: "CSS, total", bytes: sum(/^assets\/.*\.css$/), limit: BUDGETS.css },
    { what: "client JavaScript, total", bytes: sum(/^assets\/.*\.js$/), limit: BUDGETS.script },
    ...files.filter((file) => /^search\..+\.json$/.test(file)).map((file) => ({ what: file, bytes: gzipped(root, file), limit: BUDGETS.searchIndex })),
    { what: "llms-full.txt (raw)", bytes: readFileSync(join(root, "llms-full.txt")).length, limit: BUDGETS.llmsFull },
    { what: "prompt (characters)", bytes: prompt.length, limit: BUDGETS.promptCharacters },
  ];
}
