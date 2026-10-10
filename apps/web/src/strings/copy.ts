// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The announcements the adapters read: en.ts bound to the page's translator (English
// until main.ts installs it), so every announcement is made in the current language. The
// instruments' descriptions bind to the same translator in instrument-copy.ts, which only
// the engine's code imports: the manifests stay out of the initial JS.
import { bindCatalog, createTranslatorSlot, type TranslationModule, type Translator } from "@untzel/i18n";
import { announcements as english } from "./en";

const slot = createTranslatorSlot();

// Filled on demand by languages.ts, before the page switches to a language.
const translations: TranslationModule<typeof english>[] = [];
export const announcements = bindCatalog(slot, english, translations);
export function addAnnouncementTranslation(added: TranslationModule<typeof english>): void {
  if (!translations.some((module) => module.locale === added.locale)) translations.push(added);
}
/** The page's translator, for catalogs bound outside this module. */
export const pageTranslator: Translator = slot;

export function installAnnouncements(translator: Translator): void {
  slot.install(translator);
}
