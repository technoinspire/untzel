// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Test-only CSS under the app's static CSP: page.addStyleTag writes a <style>,
// which style-src 'self' blocks. A constructed sheet is CSSOM, outside the CSP; appended
// last to document.adoptedStyleSheets it wins every tie, as the <style> used to.

import type { Page } from "@playwright/test";

interface StyleSheetRegistry {
  untzelTestSheets?: Map<number, CSSStyleSheet>;
  untzelTestSheetCount?: number;
}

/** Adopts `css` in the page; the returned function removes it again. */
export async function addStyleSheet(page: Page, css: string): Promise<() => Promise<void>> {
  const id = await page.evaluate((text) => {
    const registry = globalThis as unknown as StyleSheetRegistry;
    const sheets = (registry.untzelTestSheets ??= new Map());
    const next = (registry.untzelTestSheetCount ?? 0) + 1;
    registry.untzelTestSheetCount = next;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    sheets.set(next, sheet);
    return next;
  }, css);
  return async () => {
    await page.evaluate((key) => {
      const sheets = (globalThis as unknown as StyleSheetRegistry).untzelTestSheets;
      const sheet = sheets?.get(key);
      if (sheet === undefined) return;
      sheets?.delete(key);
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== sheet);
    }, id);
  };
}
