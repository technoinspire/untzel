// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import { strings, text } from "../../copy/copy";
import { ATTRIBUTION } from "../frame/attribution";
import { createSheet, type Sheet } from "../sheets/sheet";
// Help → About and licence: the version, CPAL-1.0 and what ATTRIBUTION.md
// says must be shown in an About notice: the copyright notice, the phrase and the URL.
// They are written here, not linked: the notice must read whole even where the
// repository cannot be opened. The bar keeps the attribution too (the attribution rule).
export interface AboutFacts {
  readonly version: string;
}
/** The lines of the sheet, in order; the attribution values are fixed. */
export function aboutLines(facts: AboutFacts): readonly string[] {
  return [`${strings.version} ${facts.version}`, strings.aboutLicenceText, ATTRIBUTION.phrase, ATTRIBUTION.copyright];
}
export interface AboutSheet extends Sheet {
  /** Shown or not; the lines exist only while it shows, so the bar's attribution stays the one on the page. */
  update(isShown: boolean): void;
}
export function createAboutSheet(facts: AboutFacts, onClose: () => void): AboutSheet {
  const sheet = createSheet({ id: "ui-about", title: text.aboutTitle, className: "ui-sheet--about", onClose });
  return {
    ...sheet,
    update(isShown) {
      sheet.root.hidden = !isShown;
      if (!isShown) return void sheet.body.replaceChildren();
      const texts = aboutLines(facts);
      // Built while shown, and again after a language change.
      if (sheet.body.firstElementChild?.textContent === texts[0]) return;
      const lines = texts.map((line) => element("p", { className: "ui-about__line", text: line }));
      const site = element("a", { className: "ui-about__link", text: ATTRIBUTION.url, attributes: { href: ATTRIBUTION.url, target: "_blank", rel: "noopener" } });
      sheet.body.replaceChildren(...lines, site);
    },
  };
}
