// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The copy the command layer writes: the catalogs of strings.ts bound to the translator the
// composition installs (English until then). Every read uses the current language, so a
// result is written in the language of the moment it was asked for. The translations are
// not imported here: the composition loads them on demand (`@untzel/commands/pt-BR`) and
// adds them with addCommandsTranslations before it switches to their language, so the
// editor chunk carries English only (the bundle budget). Only the i18n core is used:
// no DOM, no storage, no clock.
import { bindCatalog, createTranslatorSlot, type TranslationModule, type Translator } from "@untzel/i18n";
import {
  assistStrings as englishAssist,
  commandSummaries as englishSummaries,
  explainStrings as englishExplain,
  strings as englishStrings,
} from "./strings";

/** The translations of one language for every catalog of the command layer. */
export interface CommandsTranslations {
  readonly strings: TranslationModule<typeof englishStrings>;
  readonly summaries: TranslationModule<typeof englishSummaries>;
  readonly assist: TranslationModule<typeof englishAssist>;
  readonly explain: TranslationModule<typeof englishExplain>;
}

const slot = createTranslatorSlot();
const translations = {
  strings: [] as TranslationModule<typeof englishStrings>[],
  summaries: [] as TranslationModule<typeof englishSummaries>[],
  assist: [] as TranslationModule<typeof englishAssist>[],
  explain: [] as TranslationModule<typeof englishExplain>[],
};

export const strings = bindCatalog(slot, englishStrings, translations.strings);
export const commandSummaries = bindCatalog(slot, englishSummaries, translations.summaries);
export const assistStrings = bindCatalog(slot, englishAssist, translations.assist);
export const explainStrings = bindCatalog(slot, englishExplain, translations.explain);

/** Adds one language; call it before the translator switches to that language. */
export function addCommandsTranslations(added: CommandsTranslations): void {
  if (translations.strings.some((module) => module.locale === added.strings.locale)) return;
  translations.strings.push(added.strings);
  translations.summaries.push(added.summaries);
  translations.assist.push(added.assist);
  translations.explain.push(added.explain);
}

/** From now on the command layer answers in the language of `translator`. */
export function installCommandsTranslator(translator: Translator): void {
  slot.install(translator);
}
