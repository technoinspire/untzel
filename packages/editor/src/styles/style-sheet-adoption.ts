// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Rules into a constructed sheet adopted by the document: CSSOM, which the
// static CSP (style-src 'self', no nonce) does not govern, unlike a <style> element.

/** What adoption needs from a document; a real Document satisfies it. */
export interface AdoptingDocument {
  readonly defaultView: { readonly CSSStyleSheet: new () => CSSStyleSheet } | null;
  adoptedStyleSheets: CSSStyleSheet[];
}

const adopted = new WeakMap<AdoptingDocument, Set<string>>();

/** Appends `cssText` as the document's last adopted sheet, once per document and text. */
export function adoptStyleSheet(document: AdoptingDocument, cssText: string): void {
  const texts = adopted.get(document) ?? new Set<string>();
  if (texts.has(cssText)) return;
  const view = document.defaultView;
  if (view === null) throw new Error("adoptStyleSheet needs a document with a window");
  const sheet = new view.CSSStyleSheet();
  sheet.replaceSync(cssText);
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  texts.add(cssText);
  adopted.set(document, texts);
}
