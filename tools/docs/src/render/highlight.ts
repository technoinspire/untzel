// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Untzel code to escaped HTML, one span per token class of the real grammar.
import { classifyTokens } from "@untzel/language";
import { escapeHtml, SafeHtml } from "./html";

export function highlightUntzel(source: string): SafeHtml {
  let out = "";
  let position = 0;
  for (const span of classifyTokens(source)) {
    out += escapeHtml(source.slice(position, span.from));
    out += `<span class="tok-${span.kind}">${escapeHtml(source.slice(span.from, span.to))}</span>`;
    position = span.to;
  }
  return new SafeHtml(out + escapeHtml(source.slice(position)));
}
