// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The copy the views read: the catalogs of strings.ts bound to the translator the
// composition installs (English until then). The translations are not imported here: the
// composition loads them on demand (`@untzel/skin/pt-BR`) and adds them with
// addControlsTranslations before it switches to their language, so the initial JS carries
// English only (the bundle budget). `strings.x` reads the current language on
// every access, for text set on refresh; `text.x` is a reader for text built once, which
// the dom helpers bind so a language change rewrites it in place.
import { bindCatalog, createTranslatorSlot, messagesOf, type TranslationModule, type Translator } from "@untzel/i18n";
import { createTextBindings } from "@untzel/i18n/dom";
import {
  effectLabels as englishEffectLabels,
  exportLabels as englishExportLabels,
  groupLabels as englishGroupLabels,
  phrases as englishPhrases,
  strings as englishStrings,
} from "./strings";
import {
  exportStretchPhrases as englishExportStretchPhrases,
  exportStretchStrings as englishExportStretchStrings,
  rangePhrases as englishRangePhrases,
  rangeStrings as englishRangeStrings,
} from "./range-strings";
const slot = createTranslatorSlot();

/** The translations of one language for every catalog of the controls. */
export interface ControlsTranslations {
  readonly strings: TranslationModule<typeof englishStrings>;
  readonly formatLabels: TranslationModule<typeof englishExportLabels>;
  readonly groupLabels: TranslationModule<typeof englishGroupLabels>;
  readonly phrases: TranslationModule<typeof englishPhrases>;
  readonly effectLabels: TranslationModule<typeof englishEffectLabels>;
  /** The play range and the export's stretch, range-strings.ts. */
  readonly rangeStrings: TranslationModule<typeof englishRangeStrings>;
  readonly rangePhrases: TranslationModule<typeof englishRangePhrases>;
  readonly exportStretchStrings: TranslationModule<typeof englishExportStretchStrings>;
  readonly exportStretchPhrases: TranslationModule<typeof englishExportStretchPhrases>;
}
const translations = {
  strings: [] as TranslationModule<typeof englishStrings>[],
  formatLabels: [] as TranslationModule<typeof englishExportLabels>[],
  groupLabels: [] as TranslationModule<typeof englishGroupLabels>[],
  phrases: [] as TranslationModule<typeof englishPhrases>[],
  effectLabels: [] as TranslationModule<typeof englishEffectLabels>[],
  rangeStrings: [] as TranslationModule<typeof englishRangeStrings>[],
  rangePhrases: [] as TranslationModule<typeof englishRangePhrases>[],
  exportStretchStrings: [] as TranslationModule<typeof englishExportStretchStrings>[],
  exportStretchPhrases: [] as TranslationModule<typeof englishExportStretchPhrases>[],
};
export const strings = bindCatalog(slot, englishStrings, translations.strings);
export const exportLabels = bindCatalog(slot, englishExportLabels, translations.formatLabels);
export const groupLabels = bindCatalog(slot, englishGroupLabels, translations.groupLabels);
export const phrases = bindCatalog(slot, englishPhrases, translations.phrases);
export const effectLabels = bindCatalog(slot, englishEffectLabels, translations.effectLabels);
export const rangeStrings = bindCatalog(slot, englishRangeStrings, translations.rangeStrings);
export const rangePhrases = bindCatalog(slot, englishRangePhrases, translations.rangePhrases);
export const exportStretchStrings = bindCatalog(slot, englishExportStretchStrings, translations.exportStretchStrings);
export const exportStretchPhrases = bindCatalog(slot, englishExportStretchPhrases, translations.exportStretchPhrases);
/** Adds one language; call it before the translator switches to that language. */
export function addControlsTranslations(added: ControlsTranslations): void {
  if (translations.strings.some((module) => module.locale === added.strings.locale)) return;
  translations.strings.push(added.strings);
  translations.formatLabels.push(added.formatLabels);
  translations.groupLabels.push(added.groupLabels);
  translations.phrases.push(added.phrases);
  translations.effectLabels.push(added.effectLabels);
  translations.rangeStrings.push(added.rangeStrings);
  translations.rangePhrases.push(added.rangePhrases);
  translations.exportStretchStrings.push(added.exportStretchStrings);
  translations.exportStretchPhrases.push(added.exportStretchPhrases);
}
export const text = messagesOf(strings);
/** Readers of the range's words, for text built once (the handles' names, the ruler's label). */
export const rangeText = messagesOf(rangeStrings);
export const exportStretchText = messagesOf(exportStretchStrings);

/** Text built once and rewritten on every language change. */
export const bindings = createTextBindings();

/** The translator the views follow; the shell installs the composition's one. */
export const translator: Translator = slot;

export function installTranslator(next: Translator): void {
  slot.install(next);
}

/** A text or a reader of it: what the dom helpers accept. */
export type Label = string | (() => string);

export function readLabel(label: Label): string {
  return typeof label === "string" ? label : label();
}
