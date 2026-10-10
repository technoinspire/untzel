// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Pieces of markup the directives share: a code example with its copy button, a table,
// and the "available now" / "planned" mark.
import type { FeatureId } from "../../../../apps/docs/src/features";
import type { RenderContext } from "../content/context";
import { highlightUntzel } from "./highlight";
import { html, type SafeHtml } from "./html";
import { icon } from "./icons";

export interface ExampleOptions {
  /** An error example: drawn with the ember bar. */
  readonly error?: boolean;
  readonly label?: string;
}

/** Copy buttons are born hidden: without JavaScript the code stays selectable text. */
export function copyButton(context: RenderContext, label: string, target: string): SafeHtml {
  return html`<button type="button" class="copy" data-copy="${target}" data-copied="${context.text.copied}" data-fallback="${context.text.copyFallback}" hidden>${icon("copy")}<span>${label}</span></button>`;
}

export function exampleFigure(context: RenderContext, code: string, options: ExampleOptions = {}): SafeHtml {
  context.codeIds.push(code);
  const id = `code-${context.codeIds.length}`;
  const kind = options.error === true ? " example--error" : "";
  return html`<figure class="example${kind}"><pre class="untzel" id="${id}"><code>${highlightUntzel(code)}</code></pre><figcaption class="example__bar"><span class="example__label">${options.label ?? "untzel"}</span>${copyButton(context, context.text.copyCode, id)}</figcaption></figure>`;
}

export interface Column {
  readonly label: string;
  /** Right-aligned with tabular figures. */
  readonly numeric?: boolean;
}

export function table(columns: readonly Column[], rows: readonly SafeHtml[], className = ""): SafeHtml {
  const head = columns.map((column) => html`<th scope="col"${column.numeric === true ? html` class="num"` : ""}>${column.label}</th>`);
  return html`<div class="table-wrap"><table class="${className}"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function statusMark(context: RenderContext, feature: FeatureId): SafeHtml {
  const available = context.data.features.get(feature) === true;
  const label = available ? context.text.available : context.text.planned;
  const state = available ? "available" : "planned";
  return html`<span class="status status--${state}" data-feature="${feature}" data-state="${state}">${icon(state)}<span>${label}</span></span>`;
}

/** Markdown fence for the llms files; the only place that writes the untzel info string. */
export function fence(code: string, info = "untzel"): string {
  return `\`\`\`${info}\n${code}\n\`\`\``;
}
