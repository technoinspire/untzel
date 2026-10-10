// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { styleTags, tags, type Tag } from "@lezer/highlight";
import { parser } from "../read/parser";

// Highlighting of the Code panel, derived from the grammar.
// The words of the language and the punctuation are read from the
// parser's own node types, so a word the grammar gains is coloured without touching this
// file; the tables below only say what a token means where it sits. The editor maps each
// category to one class; meaning still comes only from analyze().

/** The categories of the token table, one tag each. */
export const TOKEN_TAGS = {
  keyword: tags.keyword,
  signal: tags.function(tags.keyword),
  track: tags.definition(tags.variableName),
  instrument: tags.typeName,
  sound: tags.special(tags.typeName),
  pitch: tags.atom,
  accent: tags.special(tags.punctuation),
  hits: tags.literal,
  sustain: tags.special(tags.literal),
  param: tags.propertyName,
  value: tags.constant(tags.name),
  number: tags.number,
  member: tags.variableName,
  section: tags.labelName,
  punct: tags.punctuation,
  comment: tags.lineComment,
} as const satisfies Record<string, Tag>;

export type TokenCategory = keyof typeof TOKEN_TAGS;

/** Tokens with one meaning wherever they appear. */
export const TOKEN_CATEGORIES: Readonly<Record<string, TokenCategory>> = {
  Comment: "comment",
  Number: "number",
  Hits: "hits",
  Sustain: "sustain",
  Note: "pitch",
  Chord: "pitch",
  Tonic: "pitch",
  PresetName: "sound",
  // The song title between its quotes: a value, like a key's scale.
  String: "value",
  // Opaque: "!" is the accent, not punctuation.
  "Accent!": "accent",
};

/** A plain name means what the rule around it says: "kick:" names a track, "| gain" a parameter. */
export const NAME_CONTEXTS: Readonly<Record<string, TokenCategory>> = {
  TrackName: "track",
  InstrumentName: "instrument",
  ModifierName: "param",
  Value: "value",
  KeyStatement: "value",
  SectionDecl: "member",
  Part: "section",
};

/** A word of the language is a statement keyword, except inside these rules. */
export const WORD_CONTEXTS: Readonly<Record<string, TokenCategory>> = {
  SignalShape: "signal",
  ModifierName: "param",
};

const WORD = /^[a-z]+$/;
const PUNCTUATION = /^[^\p{L}\p{N}⚠]+$/u;

/** Every kw<"…"> term of the grammar: the parser names each one by the word itself. */
export const GRAMMAR_WORDS: readonly string[] = parser.nodeSet.types.map((type) => type.name).filter((name) => WORD.test(name));

/** Every literal token of the grammar ("|", ":", "..", …). */
export const GRAMMAR_PUNCTUATION: readonly string[] = parser.nodeSet.types
  .map((type) => type.name)
  .filter((name) => name !== "" && PUNCTUATION.test(name));

function contextual(contexts: Readonly<Record<string, TokenCategory>>, child: string): [string, Tag][] {
  return Object.entries(contexts).map(([parent, category]) => [`${parent}/${child}`, TOKEN_TAGS[category]]);
}

function tagSpec(): Record<string, Tag> {
  return Object.fromEntries([
    [GRAMMAR_PUNCTUATION.map((literal) => JSON.stringify(literal)).join(" "), TOKEN_TAGS.punct],
    ...Object.entries(TOKEN_CATEGORIES).map(([node, category]): [string, Tag] => [node, TOKEN_TAGS[category]]),
    ...contextual(NAME_CONTEXTS, "Name"),
    ...GRAMMAR_WORDS.flatMap((word): [string, Tag][] => [[word, TOKEN_TAGS.keyword], ...contextual(WORD_CONTEXTS, word)]),
  ]);
}

/** The selectors given to styleTags, exposed for the tests. */
export const UNTZEL_STYLE_TAGS: Readonly<Record<string, Tag>> = tagSpec();

export const untzelHighlighting = styleTags(UNTZEL_STYLE_TAGS);

/** The grammar's parser with the highlighting tags, for the editor's LRLanguage. */
export const untzelParser = parser.configure({ props: [untzelHighlighting] });
