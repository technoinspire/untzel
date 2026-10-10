// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The copy the editor and the terminal read: strings.ts and the language's messages bound
// to the translator the composition passes in (English until then). The translation of
// strings.ts is not imported here: the composition loads it on demand
// (`@untzel/editor/pt-BR`) and adds it with addEditorTranslation before it switches to its
// language, so the editor chunk carries English only (the bundle budget).
// `strings.x` reads the current language on every access; `bindings` rewrites text built
// once on a change.
import { bindCatalog, createTranslatorSlot, messagesOf, type TranslationModule, type Translator } from "@untzel/i18n";
import { createTextBindings } from "@untzel/i18n/dom";
import { englishMessages, messageTranslations, type Diagnostic, type DiagnosticFix, type MessageArg } from "@untzel/language";
import { strings as englishStrings } from "./strings";

const slot = createTranslatorSlot();
const translations: TranslationModule<typeof englishStrings>[] = [];

export const strings = bindCatalog(slot, englishStrings, translations);
const messages = bindCatalog(slot, englishMessages, messageTranslations);

/** Readers for text built once: `text.commands` reads the live catalog on every call. */
export const text = messagesOf(strings);

/** Text built once and rewritten on every language change. */
export const bindings = createTextBindings();
slot.onChange(() => bindings.refresh());

/** The translator the editor follows. */
export const translator: Translator = slot;

export function installTranslator(next: Translator): void {
  slot.install(next);
}

/** One language of strings.ts, as `@untzel/editor/pt-BR` exports it. */
export type EditorTranslation = TranslationModule<typeof englishStrings>;

/** Adds one language; call it before the translator switches to that language. */
export function addEditorTranslation(added: EditorTranslation): void {
  if (!translations.some((module) => module.locale === added.locale)) translations.push(added);
}

/** One catalog entry in the current language, or the English text when the key is unknown. */
function translated(key: string, args: readonly MessageArg[], english: string): string {
  const entry = (messages as Readonly<Record<string, unknown>>)[key];
  if (typeof entry !== "function") return english;
  try {
    return (entry as (...values: readonly MessageArg[]) => string)(...args);
  } catch {
    return english;
  }
}

/** A diagnostic's message in the current language. */
export function messageText(diagnostic: Diagnostic): string {
  return translated(diagnostic.messageKey, diagnostic.messageArgs, diagnostic.message);
}

/** A quick fix's button title in the current language. */
export function fixTitle(fix: DiagnosticFix): string {
  return translated(fix.titleKey, fix.titleArgs, fix.title);
}
