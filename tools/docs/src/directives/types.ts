// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { RenderContext } from "../content/context";
import type { SafeHtml } from "../render/html";

/** A generated block, as page HTML and as Markdown for llms-full.txt. */
export interface Rendered {
  readonly html: SafeHtml;
  readonly markdown: string;
}

export type Directive = (argument: string | null, context: RenderContext) => Rendered;

export class DirectiveError extends Error {}

export function markdownTable(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const line = (cells: readonly string[]): string => `| ${cells.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`;
  return [line(headers), line(headers.map(() => "---")), ...rows.map(line)].join("\n");
}

/** Inline code in Markdown. */
export function md(code: string): string {
  return `\`${code}\``;
}
