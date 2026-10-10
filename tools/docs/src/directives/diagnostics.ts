// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The error reference: one entry per DIAGNOSTIC_CODES, with the message the analyzer
// produces for the example examples/errors/<CODE>.untzel, and the fix from the frame copy.
import { createFormatters, translateCatalog, type Locale } from "@untzel/i18n";
import {
  DIAGNOSTIC_CODES,
  MAX_SOURCE_LENGTH,
  analyze,
  englishMessages,
  messageTranslations,
  type Diagnostic,
  type DiagnosticCode,
  type MessageArg,
  type MessageKey,
} from "@untzel/language";
import { exampleFigure } from "../render/components";
import { formatNumber, type RenderContext } from "../content/context";
import type { DocsSources } from "../content/sources";
import { html, type SafeHtml } from "../render/html";
import { DirectiveError, markdownTable, md, type Directive } from "./types";

/** Codes no text can show safely as an example. */
const SYNTHETIC: ReadonlySet<DiagnosticCode> = new Set(["SOURCE_TOO_LONG", "INTERNAL_ERROR"]);

export interface DiagnosticEntry {
  readonly code: DiagnosticCode;
  readonly severity: Diagnostic["severity"];
  /** English, as Diagnostic.message: logs, llms-full.txt and the prompt. */
  readonly message: string;
  readonly messageKey: MessageKey;
  readonly messageArgs: readonly MessageArg[];
  /** The example text, or null for the synthetic codes. */
  readonly example: string | null;
}

function diagnosticsOf(source: string, sources: Pick<DocsSources, "built">): readonly Diagnostic[] {
  const result = analyze(source, sources.built.registry);
  return result.ok ? result.warnings : result.diagnostics;
}

/** The first diagnostic of an error example; it must carry the code of the file name. */
export function diagnosticEntry(code: DiagnosticCode, sources: Pick<DocsSources, "built" | "examples">): DiagnosticEntry {
  if (code === "SOURCE_TOO_LONG") {
    const first = diagnosticsOf("x".repeat(MAX_SOURCE_LENGTH + 1), sources)[0];
    if (first === undefined) throw new DirectiveError("a text over MAX_SOURCE_LENGTH gave no diagnostic");
    return { code, severity: first.severity, message: first.message, messageKey: first.messageKey, messageArgs: first.messageArgs, example: null };
  }
  if (code === "INTERNAL_ERROR") {
    return { code, severity: "error", message: englishMessages.internalError(), messageKey: "internalError", messageArgs: [], example: null };
  }
  const example = sources.examples.get(`errors/${code}`);
  if (example === undefined) throw new DirectiveError(`apps/docs/examples/errors/${code}.untzel is missing`);
  const first = diagnosticsOf(example.text, sources)[0];
  if (first?.code !== code) throw new DirectiveError(`${example.file}: the first diagnostic is ${first?.code ?? "none"}, not ${code}`);
  return { code, severity: first.severity, message: first.message, messageKey: first.messageKey, messageArgs: first.messageArgs, example: example.text };
}

/** The message as the app shows it in locale: the same catalog the editor binds. */
export function shownMessage(entry: DiagnosticEntry, locale: Locale): string {
  const catalog = translateCatalog(englishMessages, messageTranslations, locale, createFormatters(locale));
  const message = catalog[entry.messageKey] as (...args: readonly MessageArg[]) => string;
  return message(...entry.messageArgs);
}

export function anchorOf(code: DiagnosticCode): string {
  return `error-${code.toLowerCase().replace(/_/g, "-")}`;
}

function entryHtml(entry: DiagnosticEntry, context: RenderContext): SafeHtml {
  const text = context.text;
  const severity = entry.severity === "error" ? text.error : text.warning;
  const example =
    entry.example === null
      ? html`<p>${entry.code === "SOURCE_TOO_LONG" ? text.sourceTooLongExample(formatNumber(context, MAX_SOURCE_LENGTH)) : text.internalErrorExample}</p>`
      : exampleFigure(context, entry.example, { error: true, label: text.exampleText });
  return html`<h3 id="${anchorOf(entry.code)}"><code>${entry.code}</code></h3>
<dl class="facts diagnostic" data-code="${entry.code}"><div><dt>${text.severity}</dt><dd>${severity}</dd></div><div><dt>${text.message}</dt><dd><samp lang="${context.locale}">${shownMessage(entry, context.locale)}</samp></dd></div><div><dt>${text.fix}</dt><dd>${text.diagnosticFix(entry.code)}</dd></div></dl>
${example}`;
}

export const diagnostics: Directive = (_, context) => {
  const entries = DIAGNOSTIC_CODES.map((code) => {
    if (!SYNTHETIC.has(code)) context.examples.push(`errors/${code}`);
    return diagnosticEntry(code, context.data.sources);
  });
  const text = context.text;
  return {
    html: html`${entries.map((entry) => entryHtml(entry, context))}`,
    markdown: markdownTable(
      [text.code, text.severity, text.message, text.fix],
      entries.map((entry) => [md(entry.code), entry.severity, shownMessage(entry, context.locale), text.diagnosticFix(entry.code)]),
    ),
  };
};
