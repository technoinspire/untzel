// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A page source as self-contained Markdown for llms-full.txt: directives expanded, heading
// ids removed, links made absolute, headings one level deeper (the file has one title).
import type { RenderContext } from "../content/context";
import { DIRECTIVE_LINE, DIRECTIVES, INLINE_DIRECTIVES, INLINE_LABEL, INLINE_LIMIT } from "../directives/index";
import { labelValue } from "../directives/app";
import { limitValue } from "../directives/language";
import { DirectiveError } from "../directives/types";
import { isPageId } from "../../../../apps/docs/src/pages";
import { absoluteUrl, pagePath } from "../content/site";

function expandLine(line: string, context: RenderContext, lineNumber: number): string {
  const directive = DIRECTIVE_LINE.exec(line);
  if (directive !== null && !INLINE_DIRECTIVES.has(directive[1] ?? "")) {
    const handler = DIRECTIVES[directive[1] ?? ""];
    try {
      return handler === undefined ? "" : handler(directive[2] ?? null, context).markdown.replace(/^(#+) /gm, "#$1 ");
    } catch (error) {
      if (!(error instanceof DirectiveError)) throw error;
      context.errors.push(`${context.file}:${lineNumber}: ${error.message}`);
      return "";
    }
  }
  return line
    .replace(INLINE_LIMIT, (_, name: string) => limitValue(name, context))
    .replace(INLINE_LABEL, (_, key: string) => labelValue(key, context))
    .replace(/^(#+) (.*?)\s*\{#[a-z0-9-]+\}$/, "#$1 $2")
    .replace(/\]\(([a-z-]+)\.md(#[a-z0-9-]+)?\)/g, (whole, id: string, hash: string | undefined) =>
      isPageId(id) ? `](${absoluteUrl(pagePath(id, context.locale))}${hash ?? ""})` : whole,
    );
}

export function plainMarkdown(source: string, context: RenderContext): string {
  let inFence = false;
  const lines = source.split("\n").map((line, index) => {
    if (/^```/.test(line)) inFence = !inFence;
    return inFence || /^```/.test(line) ? line : expandLine(line, context, index + 1);
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
