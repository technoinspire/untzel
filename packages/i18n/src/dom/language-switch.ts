// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The language switch of the app: one real button per locale, labelled in its own
// language. It changes the translator only; nothing here reaches the session or the audio.
import type { Locale } from "../locales";
import { switchModel } from "../switch-model";
import type { Translator } from "../translator";
import { saveLocale, type LocaleStore } from "./locale-store";

export interface LanguageSwitchOptions {
  readonly translator: Translator;
  readonly store: LocaleStore | null;
  /** Accessible name of the group, read again on every change ("Language", "Idioma"). */
  readonly groupLabel: () => string;
}

export interface LanguageSwitch {
  readonly element: HTMLElement;
  destroy(): void;
}

export function createLanguageSwitch(options: LanguageSwitchOptions): LanguageSwitch {
  const { translator, store, groupLabel } = options;
  const root = document.createElement("div");
  root.className = "untzel-lang";
  root.setAttribute("role", "group");
  const buttons = new Map<Locale, HTMLButtonElement>();
  for (const item of switchModel(translator.locale())) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "untzel-lang__item";
    button.lang = item.lang;
    button.textContent = item.label;
    button.addEventListener("click", () => {
      saveLocale(store, item.locale);
      translator.setLocale(item.locale);
    });
    buttons.set(item.locale, button);
    root.append(button);
  }
  const sync = (locale: Locale): void => {
    root.setAttribute("aria-label", groupLabel());
    for (const [candidate, button] of buttons) button.setAttribute("aria-pressed", String(candidate === locale));
  };
  sync(translator.locale());
  const unsubscribe = translator.onChange(sync);
  return {
    element: root,
    destroy() {
      unsubscribe();
      root.remove();
    },
  };
}
