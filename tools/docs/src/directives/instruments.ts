// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The instrument reference, from the manifests of the build: no number is written by hand.
// Descriptions come from the same catalog the library shows, in the page's language.
import type { InstrumentManifest, ManifestParameter } from "@untzel/core";
import { translateCatalog } from "@untzel/i18n";
import { instrumentText, soundKey } from "../../../../apps/web/src/strings/instruments";
import instrumentsPortuguese from "../../../../apps/web/src/strings/instruments.pt-BR";
import { exampleFigure, table } from "../render/components";
import { formatNumber, type RenderContext } from "../content/context";
import { html, type SafeHtml } from "../render/html";
import { markdownTable, md, type Directive } from "./types";

/** The default pattern as a whole track line, the one Add track writes. */
export function defaultTrackLine(manifest: InstrumentManifest): string {
  return `${manifest.name}: ${manifest.name} ${manifest.defaultPattern}`;
}

function cell(value: number, context: RenderContext): SafeHtml {
  return html`<td class="num" data-value="${value}">${formatNumber(context, value)}</td>`;
}

/** The descriptions of the instruments and their sounds in the page's language. */
function descriptions(context: RenderContext): Readonly<Record<string, string>> {
  return translateCatalog(instrumentText, [instrumentsPortuguese], context.locale, context.formatters);
}

/** A choice parameter: its first, last and default choice by name, each cell keeping its index. */
function choiceRow(manifest: InstrumentManifest, parameter: ManifestParameter, choices: readonly string[], context: RenderContext): SafeHtml {
  const named = (index: number): SafeHtml => html`<td data-value="${index}"><code>${choices[index] ?? ""}</code></td>`;
  return html`<tr data-instrument="${manifest.name}" data-parameter="${parameter.name}" data-unit="${parameter.unit}" data-curve="${parameter.curve}"><th scope="row"><code>${parameter.name}</code></th>${named(parameter.min)}${named(parameter.max)}${named(parameter.default)}<td>${context.text.oneOf(context.formatters.list(choices))}</td><td></td></tr>`;
}

function parameterRow(manifest: InstrumentManifest, parameter: ManifestParameter, context: RenderContext): SafeHtml {
  if (parameter.choices !== null) return choiceRow(manifest, parameter, parameter.choices, context);
  const unit = parameter.unit === "" ? context.text.noUnit : parameter.unit;
  return html`<tr data-instrument="${manifest.name}" data-parameter="${parameter.name}" data-unit="${parameter.unit}" data-curve="${parameter.curve}"><th scope="row"><code>${parameter.name}</code></th>${cell(parameter.min, context)}${cell(parameter.max, context)}${cell(parameter.default, context)}<td>${unit}</td><td>${context.text.curveLabel(parameter.curve)}</td></tr>`;
}

/** The model name comes first, as the library shows it next to the language word. */
function facts(manifest: InstrumentManifest, context: RenderContext): readonly (readonly [string, string])[] {
  return [
    ...(manifest.model === null ? [] : [[context.text.model, manifest.model] as const]),
    [context.text.group, context.text.groupLabel(manifest.group)],
    [context.text.kind, context.text.kindLabel(manifest.kind)],
    [context.text.voices, formatNumber(context, manifest.voices)],
    [context.text.defaultDuck, formatNumber(context, manifest.defaultDuck)],
  ];
}

function instrumentHtml(manifest: InstrumentManifest, context: RenderContext): SafeHtml {
  const text = context.text;
  const parameterColumns = [
    { label: text.parameter },
    { label: text.minimum, numeric: true },
    { label: text.maximum, numeric: true },
    { label: text.defaultValue, numeric: true },
    { label: text.unit },
    { label: text.curve },
  ];
  const toneColumns = [{ label: text.parameter }, { label: text.toneFrom, numeric: true }, { label: text.toneTo, numeric: true }];
  const words = descriptions(context);
  const soundColumns = [{ label: text.soundName }, { label: text.notesColumn }];
  const soundRows = manifest.presets.map(
    (preset) => html`<tr data-sound="${manifest.name}/${preset.name}"><th scope="row"><code>${preset.name}</code>${preset.name === manifest.defaultPreset ? html` <span class="caption">${text.defaultSound}</span>` : html``}</th><td>${words[soundKey(manifest.name, preset.name)] ?? preset.description}</td></tr>`,
  );
  const toneRows = manifest.tone.map(
    (mapping) => html`<tr data-tone="${manifest.name}"><th scope="row"><code>${mapping.parameter}</code></th>${cell(mapping.from, context)}${cell(mapping.to, context)}</tr>`,
  );
  return html`<h2 id="${manifest.name}"><code>${manifest.name}</code></h2>
<p>${words[manifest.name] ?? manifest.description}</p>
<dl class="facts">${facts(manifest, context).map(([term, value]) => html`<div><dt>${term}</dt><dd>${value}</dd></div>`)}</dl>
<h3 id="${manifest.name}-sounds">${text.sounds}</h3>
${table(soundColumns, soundRows, "sounds")}
<p class="caption">${text.defaultPattern}</p>
${exampleFigure(context, defaultTrackLine(manifest))}
${table(parameterColumns, manifest.parameters.map((parameter) => parameterRow(manifest, parameter, context)), "parameters")}
<h3 id="${manifest.name}-tone">${text.toneHeading}</h3>
${table(toneColumns, toneRows, "tone")}`;
}

function instrumentMarkdown(manifest: InstrumentManifest, context: RenderContext): string {
  const text = context.text;
  const number = (value: number): string => formatNumber(context, value);
  const factLine = facts(manifest, context).map(([term, value]) => `${term}: ${value}`).join(". ");
  const words = descriptions(context);
  const parameters = markdownTable(
    [text.parameter, text.minimum, text.maximum, text.defaultValue, text.unit, text.curve],
    manifest.parameters.map((p) =>
      p.choices === null
        ? [md(p.name), number(p.min), number(p.max), number(p.default), p.unit === "" ? text.noUnit : p.unit, p.curve]
        : [md(p.name), md(p.choices[p.min] ?? ""), md(p.choices[p.max] ?? ""), md(p.choices[p.default] ?? ""), text.oneOf(context.formatters.list(p.choices)), ""],
    ),
  );
  const sounds = markdownTable(
    [text.soundName, text.notesColumn],
    manifest.presets.map((preset) => [`${md(preset.name)}${preset.name === manifest.defaultPreset ? ` (${text.defaultSound})` : ""}`, words[soundKey(manifest.name, preset.name)] ?? preset.description]),
  );
  const tone = markdownTable(
    [text.parameter, text.toneFrom, text.toneTo],
    manifest.tone.map((mapping) => [md(mapping.parameter), number(mapping.from), number(mapping.to)]),
  );
  return [`## ${manifest.name}`, words[manifest.name] ?? manifest.description, `${factLine}.`, `### ${text.sounds}`, sounds, `${text.defaultPattern}: ${md(defaultTrackLine(manifest))}`, parameters, `### ${text.toneHeading}`, tone].join("\n\n");
}

export const instruments: Directive = (_, context) => {
  const all = context.data.sources.built.instruments;
  return {
    html: html`${all.map((manifest) => instrumentHtml(manifest, context))}`,
    markdown: all.map((manifest) => instrumentMarkdown(manifest, context)).join("\n\n"),
  };
};
