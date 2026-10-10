// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The catalogs of a language, loaded once and before the page speaks it. English is the
// source and is always there; pt-BR comes in its own chunk.
import type { CommandsTranslations } from "@untzel/commands";
import { addControlsTranslations } from "@untzel/skin";
import type { EditorTranslation } from "@untzel/editor";
import type { Locale } from "@untzel/i18n";
import { addAnnouncementTranslation } from "./copy";
/** The Code panel's catalogs of one language; the editor chunk adds them to its packages. */
export interface CodeTranslations {
  readonly editor: EditorTranslation;
  readonly commands: CommandsTranslations;
}
const loading = new Map<Locale, Promise<void>>();
const codeTranslations: CodeTranslations[] = [];
const codeListeners = new Set<(added: CodeTranslations) => void>();
function addCodeTranslations(added: CodeTranslations): void {
  codeTranslations.push(added);
  for (const listener of [...codeListeners]) listener(added);
}
/** Every Code panel catalog loaded so far, then each one as it loads; returns the unsubscribe. */
export function onCodeTranslations(listener: (added: CodeTranslations) => void): () => void {
  for (const added of codeTranslations) listener(added);
  codeListeners.add(listener);
  return () => codeListeners.delete(listener);
}
const LOADERS: Readonly<Partial<Record<Locale, () => Promise<void>>>> = {
  "pt-BR": () =>
    import("./portuguese").then(({ controlsPortuguese, announcementsPortuguese, editorPortuguese, commandsPortuguese }) => {
      addControlsTranslations(controlsPortuguese);
      addAnnouncementTranslation(announcementsPortuguese);
      addCodeTranslations({ editor: editorPortuguese, commands: commandsPortuguese });
    }),
};
export function loadLanguage(locale: Locale): Promise<void> {
  const loader = LOADERS[locale];
  if (loader === undefined) return Promise.resolve();
  let pending = loading.get(locale);
  if (pending === undefined) {
    pending = loader();
    // A failed load (offline) may be tried again on the next switch.
    pending.catch(() => loading.delete(locale));
    loading.set(locale, pending);
  }
  return pending;
}
