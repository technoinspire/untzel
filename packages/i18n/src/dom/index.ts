// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Browser adapters of @untzel/i18n: the saved choice, text that follows the language and
// the language switch. Only adapters import this entry (dependency-cruiser enforces it).
export type { LocaleStore } from "./locale-store";
export { LOCALE_STORAGE_KEY, browserLocaleStore, enhanceLanguageLinks, readSavedLocale, saveLocale } from "./locale-store";
export type { TextBindings, TextReader } from "./text-bindings";
export { createTextBindings } from "./text-bindings";
export type { LanguageSwitch, LanguageSwitchOptions } from "./language-switch";
export { createLanguageSwitch } from "./language-switch";
