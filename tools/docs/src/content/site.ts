// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Where the docs live, and the URL scheme of the generated pages: the docs at
// untzel.com/docs/, published by the institutional site, and the app on its own origin,
// app.untzel.com. Every asset URL is relative to the page; only canonical, hreflang, the
// sitemap, the llms files and the app link need an absolute URL, and they all read it here.
import type { Locale } from "@untzel/i18n";
import { pageSlug, type PageId } from "../../../../apps/docs/src/pages";

export const SITE_ORIGIN = "https://untzel.com";
export const DOCS_PATH = "/docs/";
export const DOCS_URL = `${SITE_ORIGIN}${DOCS_PATH}`;
/** The app is a separate origin, so its link is absolute. */
export const APP_URL = "https://app.untzel.com/";

/** Folder of a locale below the docs root: pt-BR is the root, English is en/. */
const LOCALE_FOLDER: Readonly<Record<Locale, string>> = { "pt-BR": "", en: "en/" };

/** Path of a page below the docs root, with a trailing slash: "", "language/", "en/", "en/language/". */
export function pagePath(id: PageId, locale: Locale): string {
  const slug = pageSlug(id);
  return `${LOCALE_FOLDER[locale]}${slug === "" ? "" : `${slug}/`}`;
}

/** Segments below /docs/: 0 at the pt-BR root, 1 in language/ and en/, 2 in en/language/. */
export function depthOf(path: string): number {
  return path.split("/").filter((segment) => segment !== "").length;
}

/** From a page to the docs root, as a relative URL prefix. */
export function rootPrefix(depth: number): string {
  return depth === 0 ? "./" : "../".repeat(depth);
}

/** Relative URL from one docs path to another (both below the docs root). */
export function relativeHref(fromPath: string, toPath: string, hash = ""): string {
  return `${rootPrefix(depthOf(fromPath))}${toPath}${hash}`;
}

/** The app's link from any page: the same absolute URL at every depth. */
export function appHref(): string {
  return APP_URL;
}

export function absoluteUrl(path: string): string {
  return `${DOCS_URL}${path}`;
}
