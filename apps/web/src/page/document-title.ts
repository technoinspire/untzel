// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The browser tab names the song: "Midnight Coast · Untzel" with a project
// open, the page's own "Untzel · Techno Inspire" without one.
import { livePhrases as phrases } from "@untzel/skin";

export const HOME_TITLE = "Untzel · Techno Inspire";

export function documentTitle(title: string | null): string {
  return title === null ? HOME_TITLE : phrases.documentTitle(title);
}

/** Keeps document.title in step with the view; writes only on a change. */
export function followDocumentTitle(doc: Pick<Document, "title">): (title: string | null) => void {
  return (title) => {
    const next = documentTitle(title);
    if (doc.title !== next) doc.title = next;
  };
}
