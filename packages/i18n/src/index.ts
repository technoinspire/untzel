// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// @untzel/i18n: the one translation component of the system.
// This entry has no DOM; @untzel/i18n/dom holds the browser adapters.
export type { Catalog, Entry, MessageRef, Referenced, Thunks, Translation, TranslationModule } from "./catalog";
export { bindCatalog, defineTranslation, messagesOf, referenced, translateCatalog } from "./catalog";
export type { Formatters, PluralForms } from "./formatters";
export { createFormatters } from "./formatters";
export type { Locale, LocaleInputs } from "./locales";
export { ENDONYMS, LOCALES, SOURCE_LOCALE, SWITCH_ORDER, matchLocale, resolveLocale } from "./locales";
export type { SwitchItem, SwitchLabels } from "./switch-model";
export { renderSwitchHtml, switchModel } from "./switch-model";
export type { LocaleListener, Translator, TranslatorSlot } from "./translator";
export { createTranslator, createTranslatorSlot } from "./translator";
