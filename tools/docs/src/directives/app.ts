// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Blocks about the app and its code: examples, templates, keyboard shortcuts, feature
// status and the AI prompt.
import { strings as controlsStrings } from "@untzel/skin-booth";
import { shortcutFor, type KeyDescriptor, type ShortcutAction } from "@untzel/skin-contract";
import { stringsPtBr } from "@untzel/skin-booth/pt-BR";
import { translateCatalog } from "@untzel/i18n";
import { pitchClassName, toNumber } from "@untzel/core";
import { analyze } from "@untzel/language";
import { EXAMPLE_REQUIREMENTS, FEATURES, type FeatureId } from "../../../../apps/docs/src/features";
import { copyButton, exampleFigure, fence, statusMark, table } from "../render/components";
import { formatNumber, type RenderContext } from "../content/context";
import { html } from "../render/html";
import { DirectiveError, markdownTable, md, type Directive, type Rendered } from "./types";

const EMPTY: Rendered = { html: html``, markdown: "" };

export const example: Directive = (argument, context) => {
  const id = argument ?? "";
  const file = context.data.sources.examples.get(id);
  if (file === undefined) throw new DirectiveError(`unknown example "${id}" (apps/docs/examples/${id}.untzel)`);
  context.examples.push(id);
  const requirement = EXAMPLE_REQUIREMENTS[id];
  if (requirement !== undefined && context.data.features.get(requirement) !== true) return EMPTY;
  return { html: exampleFigure(context, file.text), markdown: fence(file.text) };
};

/** `{{template <id>}}`, or `{{template first-touch}}` for the one the first tap plays. */
export const template: Directive = (argument, context) => {
  const { templates: library, firstTouch } = context.data.sources;
  const id = argument === "first-touch" ? firstTouch : argument;
  const found = library.find((candidate) => candidate.id === id);
  if (found === undefined) throw new DirectiveError(`unknown template "${argument ?? ""}"`);
  return { html: exampleFigure(context, found.text, { label: found.name }), markdown: fence(found.text) };
};

/** The library as the style tabs show it: style, name, tempo, key, tracks and song. */
export const templates: Directive = (_, context) => {
  const text = context.text;
  const rows = context.data.sources.templates.map((found) => {
    const result = analyze(found.text, context.data.sources.built.registry);
    if (!result.ok) throw new DirectiveError(`template ${found.id} does not analyze`);
    const { program } = result;
    const bars = program.song?.parts.reduce((total, part) => total + part.bars, 0) ?? null;
    const key = program.key === null ? "" : `${pitchClassName(program.key.tonic)} ${program.key.scale}`;
    return [found.style ?? text.noStyle, found.name, formatNumber(context, toNumber(program.tempo)), key, formatNumber(context, program.tracks.length), bars === null ? text.noSong : text.bars(bars)] as const;
  });
  const columns = [{ label: text.style }, { label: text.template }, { label: text.tempo, numeric: true }, { label: text.musicalKey }, { label: text.tracks, numeric: true }, { label: text.song }];
  return {
    html: table(columns, rows.map(([style, name, tempo, key, tracks, song]) => html`<tr><td>${style}</td><th scope="row">${name}</th><td class="num">${tempo}</td><td>${key}</td><td class="num">${tracks}</td><td>${song}</td></tr>`)),
    markdown: markdownTable(columns.map((column) => column.label), rows.map(([style, name, tempo, key, tracks, song]) => [style, name, tempo, key, tracks, song])),
  };
};

interface ShortcutRow {
  readonly label: string;
  readonly keys: readonly Partial<KeyDescriptor>[];
}

function shortcutRows(context: RenderContext): readonly ShortcutRow[] {
  const mod = { mod: true };
  return [
    { label: context.text.keySpace, keys: [{ key: " " }] },
    { label: "1–9", keys: [{ key: "1" }, { key: "9" }] },
    { label: "A", keys: [{ key: "a" }] },
    { label: "D", keys: [{ key: "d" }] },
    { label: "H", keys: [{ key: "h" }] },
    { label: "[ ]", keys: [{ key: "[" }, { key: "]" }] },
    { label: context.text.keyEscape, keys: [{ key: "Escape" }] },
    { label: "Mod+Z", keys: [{ ...mod, key: "z" }] },
    { label: "Mod+Shift+Z", keys: [{ ...mod, shift: true, key: "z" }] },
    { label: "Mod+Enter", keys: [{ ...mod, key: "Enter" }] },
    { label: "Mod+.", keys: [{ ...mod, key: "." }] },
    { label: "Mod+S", keys: [{ ...mod, key: "s" }] },
  ];
}

/**
 * Keys the Code editor keeps for itself (packages/editor/src/view/code-editor.ts, its keymap
 * stops them reaching the page): undo, redo and Mod+Enter do the same there; Mod+.
 * applies a quick fix there instead of stopping the music.
 */
const SAME_IN_EDITOR: ReadonlySet<ShortcutAction["kind"]> = new Set(["undo", "redo", "apply-now"]);
const OTHER_IN_EDITOR: ReadonlySet<ShortcutAction["kind"]> = new Set(["stop"]);

function descriptor(partial: Partial<KeyDescriptor>, inText: boolean): KeyDescriptor {
  return { key: "", mod: false, shift: false, alt: false, onControl: false, ...partial, inText };
}

/** Every key of a row must give the same action kind; every kind must appear. */
function resolvedShortcuts(context: RenderContext): readonly (readonly [string, ShortcutAction["kind"], boolean])[] {
  const rows = shortcutRows(context).map((row) => {
    const kinds = new Set(row.keys.map((key) => shortcutFor(descriptor(key, false))?.kind ?? null));
    const [kind] = [...kinds];
    if (kinds.size !== 1 || kind === null || kind === undefined) throw new DirectiveError(`shortcut ${row.label} has no single action`);
    const reachesShell = row.keys.every((key) => shortcutFor(descriptor(key, true)) !== null);
    const inEditor = SAME_IN_EDITOR.has(kind) || (reachesShell && !OTHER_IN_EDITOR.has(kind));
    return [row.label, kind, inEditor] as const;
  });
  const seen = new Set(rows.map(([, kind]) => kind));
  const kinds = Object.keys(SHORTCUT_KINDS) as ShortcutAction["kind"][];
  const missing = kinds.filter((kind) => !seen.has(kind));
  if (missing.length > 0) throw new DirectiveError(`shortcut actions without a key in the table: ${missing.join(", ")}`);
  return rows;
}

/** The action kinds of ShortcutAction; the Record type fails compilation when one is added. */
export const SHORTCUT_KINDS: Readonly<Record<ShortcutAction["kind"], true>> = {
  "toggle-play": true,
  stop: true,
  "toggle-track": true,
  "add-track": true,
  drop: true,
  undo: true,
  redo: true,
  "apply-now": true,
  close: true,
  "toggle-controls": true,
  "loop-length": true,
  save: true,
};

export const shortcuts: Directive = (_, context) => {
  const text = context.text;
  const rows = resolvedShortcuts(context).map(([label, kind, inEditor]) => [label, text.shortcutAction(kind), inEditor ? text.anywhere : text.outsideEditor, kind] as const);
  const columns = [{ label: text.key }, { label: text.action }, { label: text.where }];
  return {
    html: html`${table(columns, rows.map(([label, action, where, kind]) => html`<tr data-shortcut="${kind}"><th scope="row"><kbd>${label}</kbd></th><td>${action}</td><td>${where}</td></tr>`))}<p class="caption">${text.modNote}</p>`,
    markdown: `${markdownTable(columns.map((column) => column.label), rows.map(([label, action, where]) => [md(label), action, where]))}\n\n${text.modNote}`,
  };
};

function featureId(argument: string | null): FeatureId {
  const found = FEATURES.find((feature) => feature.id === argument);
  if (found === undefined) throw new DirectiveError(`unknown feature "${argument ?? ""}"`);
  return found.id;
}

export const status: Directive = (argument, context) => {
  const id = featureId(argument);
  const available = context.data.features.get(id) === true;
  const label = available ? context.text.available : context.text.planned;
  return {
    html: html`<p class="status-line">${statusMark(context, id)} <strong>${context.text.featureName(id)}.</strong> ${context.text.featureNote(id)}</p>`,
    markdown: `${label}: ${context.text.featureName(id)}. ${context.text.featureNote(id)}`,
  };
};

export const features: Directive = (_, context) => {
  const text = context.text;
  const columns = [{ label: text.featureColumn }, { label: text.statusColumn }, { label: text.notesColumn }];
  return {
    // A list, not a table: on a phone the note gets the whole width under its name.
    html: html`<dl class="features">${FEATURES.map((feature) => html`<div><dt>${text.featureName(feature.id)}</dt><dd>${statusMark(context, feature.id)}</dd><dd>${text.featureNote(feature.id)}</dd></div>`)}</dl>`,
    markdown: markdownTable(
      columns.map((column) => column.label),
      FEATURES.map((feature) => [text.featureName(feature.id), context.data.features.get(feature.id) === true ? text.available : text.planned, text.featureNote(feature.id)]),
    ),
  };
};

export const aiPrompt: Directive = (_, context) => ({
  html: html`<figure class="prompt"><pre class="prompt__text" id="ai-prompt" lang="en">${context.data.prompt}</pre><figcaption class="example__bar"><span class="example__label">prompt</span>${copyButton(context, context.text.copyPrompt, "ai-prompt")}</figcaption></figure>`,
  markdown: "",
});

/** A static label of the app in the page's language, from the same catalog the app reads. */
export function labelValue(key: string, context: RenderContext): string {
  const catalog = translateCatalog(controlsStrings, [stringsPtBr], context.locale, context.formatters) as Readonly<Record<string, unknown>>;
  const value = catalog[key];
  if (typeof value !== "string") throw new DirectiveError(`"${key}" is not a text label of packages/skins/booth/src/copy/strings.ts`);
  return value;
}
