// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The language of the controls: installs the composition's translator and, on a change,
// rewrites the bound text and asks the shell to render again. No reload, no new DOM,
// nothing sent to the session or the audio: the music keeps playing.
// The choice is made in the menu's Language group, through the LanguageChoice port this
// implements: choose saves the locale on this device and switches the translator.
import type { Translator } from "@untzel/i18n";
import { browserLocaleStore, saveLocale, type LocaleStore } from "@untzel/i18n/dom";
import { bindings, installTranslator, translator } from "../../copy/copy";
import type { LanguageChoice } from "./language-choice";
export interface LanguageControlOptions {
  /** Without one the controls stay in English. */
  readonly translator?: Translator;
  /** Where the choice is saved; undefined means localStorage, null means nowhere. */
  readonly store?: LocaleStore | null;
  readonly onChange: () => void;
}
export interface LanguageControl extends LanguageChoice {
  destroy(): void;
}
export function createLanguageControl(options: LanguageControlOptions): LanguageControl {
  if (options.translator !== undefined) {
    installTranslator(options.translator);
    // Views built before this one (the toast, the undo buttons) bound their text in English.
    bindings.refresh();
  }
  const store = options.store === undefined ? browserLocaleStore() : options.store;
  const unsubscribe = translator.onChange(() => {
    bindings.refresh();
    options.onChange();
  });
  return {
    current: () => translator.locale(),
    choose(locale) {
      saveLocale(store, locale);
      translator.setLocale(locale);
    },
    destroy: unsubscribe,
  };
}
