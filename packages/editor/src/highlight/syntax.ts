// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { HighlightStyle, LanguageSupport, LRLanguage, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { TOKEN_TAGS, untzelParser, type TokenCategory } from "@untzel/language";

// The Untzel language in the editor: the grammar's
// own parser with its highlighting tags, and one class per category of the language's
// token table. The colors are CSS custom properties in styles/language.css, each one
// measured on the panel surface.

export type { TokenCategory };

/** "keyword" -> "u-tok-keyword". */
export function tokenClass(category: TokenCategory): string {
  return `u-tok-${category}`;
}

const CATEGORIES = Object.keys(TOKEN_TAGS) as TokenCategory[];

/** The classes of the token table; the tests sample their computed colors. */
export const TOKEN_CLASSES: Readonly<Record<TokenCategory, string>> = Object.fromEntries(
  CATEGORIES.map((category) => [category, tokenClass(category)]),
) as Record<TokenCategory, string>;

/** Classes, not inline styles: the page runs under a strict CSP. */
export const untzelHighlightStyle = HighlightStyle.define(
  CATEGORIES.map((category) => ({ tag: TOKEN_TAGS[category], class: tokenClass(category) })),
);

export const untzelLanguage = LRLanguage.define({
  name: "untzel",
  parser: untzelParser,
  languageData: { commentTokens: { line: "//" } },
});

export function untzelSyntax(): Extension {
  return [new LanguageSupport(untzelLanguage), syntaxHighlighting(untzelHighlightStyle)];
}
