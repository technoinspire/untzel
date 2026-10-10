// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Tables of the language, from LANGUAGE_FACTS and the grammar file: modifiers, section
// modifiers, limits and the normative grammar.
import { LANGUAGE_FACTS, type ModifierFact, type NumericFact } from "@untzel/language";
import { table } from "../render/components";
import { formatNumber, type RenderContext } from "../content/context";
import { html } from "../render/html";
import { DirectiveError, markdownTable, md, type Directive } from "./types";

function rangeText(fact: NumericFact, context: RenderContext): string {
  const min = formatNumber(context, fact.min);
  const max = formatNumber(context, fact.max);
  const range = fact.integer ? context.text.wholeRange(min, max) : context.text.numberRange(min, max);
  return fact.allowsSignal ? `${range}, ${context.text.orSignal}` : range;
}

function valueText(fact: ModifierFact, context: RenderContext): string {
  switch (fact.kind) {
    case "flag":
      return context.text.flagValue;
    case "number":
      return rangeText(fact, context);
    case "reverb":
      return context.text.spacesOr(context.formatters.list(fact.spaces), formatNumber(context, fact.min), formatNumber(context, fact.max));
    case "division":
      return context.text.oneOf(context.formatters.list(fact.divisions));
    case "choice":
      return context.text.oneOf(context.formatters.list(fact.choices));
  }
}

function effect(name: string, context: RenderContext): string {
  const text = context.text.modifierEffect(name);
  if (text === "") throw new DirectiveError(`modifier "${name}" has no description in apps/docs/src/strings.ts`);
  return text;
}

export const generalModifiers: Directive = (_, context) => {
  const rows = LANGUAGE_FACTS.modifiers.map((fact) => [fact.name, valueText(fact, context), effect(fact.name, context)] as const);
  const columns = [{ label: context.text.modifier }, { label: context.text.value }, { label: context.text.effect }];
  return {
    html: table(columns, rows.map(([name, value, text]) => html`<tr data-modifier="${name}"><th scope="row"><code>${name}</code></th><td>${value}</td><td>${text}</td></tr>`)),
    markdown: markdownTable(columns.map((column) => column.label), rows.map(([name, value, text]) => [md(name), value, text])),
  };
};

export const sectionModifiers: Directive = (_, context) => {
  const rows = LANGUAGE_FACTS.sectionModifiers.map((fact) => [fact.name, rangeText(fact, context), context.text.sectionModifierEffect(fact.name)] as const);
  const columns = [{ label: context.text.modifier }, { label: context.text.value }, { label: context.text.effect }];
  return {
    html: table(columns, rows.map(([name, value, text]) => html`<tr><th scope="row"><code>${name}</code></th><td>${value}</td><td>${text}</td></tr>`)),
    markdown: markdownTable(columns.map((column) => column.label), rows.map(([name, value, text]) => [md(name), value, text])),
  };
};

export const limits: Directive = (_, context) => {
  const rows = Object.entries(LANGUAGE_FACTS.limits).map(([name, value]) => {
    const meaning = context.text.limitLabel(name);
    if (meaning === "") throw new DirectiveError(`limit ${name} has no description in apps/docs/src/strings.ts`);
    return [name, formatNumber(context, value), meaning, value] as const;
  });
  const columns = [{ label: context.text.limit }, { label: context.text.limitValue, numeric: true }, { label: context.text.limitMeaning }];
  return {
    html: table(columns, rows.map(([name, shown, meaning, value]) => html`<tr data-limit="${name}"><th scope="row"><code>${name}</code></th><td class="num" data-value="${value}">${shown}</td><td>${meaning}</td></tr>`)),
    markdown: markdownTable(columns.map((column) => column.label), rows.map(([name, shown, meaning]) => [md(name), shown, meaning])),
  };
};

/** The value of a limit in prose: the inline {{limit NAME}}. */
export function limitValue(name: string, context: RenderContext): string {
  const value = LANGUAGE_FACTS.limits[name];
  if (value === undefined) throw new DirectiveError(`unknown limit ${name}`);
  return formatNumber(context, value);
}

/** untzel.grammar without its header comments. */
export function grammarBody(text: string): string {
  const lines = text.split("\n");
  const first = lines.findIndex((line) => !line.startsWith("//"));
  return lines.slice(first).join("\n").trimEnd();
}

export const grammar: Directive = (_, context) => {
  const body = grammarBody(context.data.sources.grammar.text);
  return {
    html: html`<figure class="grammar"><pre class="code"><code>${body}</code></pre><figcaption>${context.text.grammarCaption}</figcaption></figure>`,
    markdown: `\`\`\`text\n${body}\n\`\`\``,
  };
};
