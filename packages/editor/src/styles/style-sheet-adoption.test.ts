// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { adoptStyleSheet, type AdoptingDocument } from "./style-sheet-adoption";

class FakeSheet {
  text: string | null = null;
  replaceSync(text: string): void {
    this.text = text;
  }
}

function fakeDocument(existing: FakeSheet[] = []): AdoptingDocument {
  return {
    defaultView: { CSSStyleSheet: FakeSheet as unknown as new () => CSSStyleSheet },
    adoptedStyleSheets: existing as unknown as CSSStyleSheet[],
  };
}

const textOf = (document: AdoptingDocument): (string | null)[] =>
  (document.adoptedStyleSheets as unknown as FakeSheet[]).map((sheet) => sheet.text);

describe("adoptStyleSheet", () => {
  it("appends the sheet after the ones already adopted, so it wins their ties", () => {
    const codeMirror = new FakeSheet();
    codeMirror.text = "codemirror";
    const document = fakeDocument([codeMirror]);
    adoptStyleSheet(document, ".untzel-editor { display: flex }");
    expect(textOf(document)).toEqual(["codemirror", ".untzel-editor { display: flex }"]);
  });

  it("adopts the same text once per document", () => {
    const document = fakeDocument();
    adoptStyleSheet(document, ".a {}");
    adoptStyleSheet(document, ".a {}");
    expect(textOf(document)).toEqual([".a {}"]);
  });

  it("adopts a different text as another sheet", () => {
    const document = fakeDocument();
    adoptStyleSheet(document, ".a {}");
    adoptStyleSheet(document, ".b {}");
    expect(textOf(document)).toEqual([".a {}", ".b {}"]);
  });

  it("gives a second document its own sheet", () => {
    const first = fakeDocument();
    const second = fakeDocument();
    adoptStyleSheet(first, ".a {}");
    adoptStyleSheet(second, ".a {}");
    expect(textOf(first)).toEqual([".a {}"]);
    expect(textOf(second)).toEqual([".a {}"]);
  });

  it("refuses a document without a window", () => {
    const document: AdoptingDocument = { defaultView: null, adoptedStyleSheets: [] };
    expect(() => adoptStyleSheet(document, ".a {}")).toThrow("window");
  });
});
