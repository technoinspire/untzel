// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { HOME_TITLE, documentTitle, followDocumentTitle } from "./document-title";

describe("documentTitle", () => {
  it("names the song, or the page with no project", () => {
    expect(documentTitle("Midnight Coast")).toBe("Midnight Coast · Untzel");
    expect(documentTitle("Untitled")).toBe("Untitled · Untzel");
    expect(documentTitle(null)).toBe(HOME_TITLE);
  });
  it("follows the view", () => {
    const doc = { title: HOME_TITLE };
    const follow = followDocumentTitle(doc);
    follow("Night Drive");
    expect(doc.title).toBe("Night Drive · Untzel");
    follow(null);
    expect(doc.title).toBe("Untzel · Techno Inspire");
  });
});
