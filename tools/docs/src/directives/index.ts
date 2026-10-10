// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The block directives a page can use: a whole line {{name argument}}. Unknown names are
// a generator error.
import { aiPrompt, example, features, shortcuts, status, template, templates } from "./app";
import { commands } from "./commands";
import { credits } from "./credits";
import { diagnostics } from "./diagnostics";
import { instruments } from "./instruments";
import { generalModifiers, grammar, limits, sectionModifiers } from "./language";
import type { Directive } from "./types";

export const DIRECTIVES: Readonly<Record<string, Directive>> = {
  example,
  template,
  templates,
  instruments,
  "general-modifiers": generalModifiers,
  "section-modifiers": sectionModifiers,
  limits,
  grammar,
  diagnostics,
  shortcuts,
  commands,
  status,
  features,
  "ai-prompt": aiPrompt,
  credits,
};

/** A whole line that is a directive: {{name}} or {{name argument}}. */
export const DIRECTIVE_LINE = /^\{\{([a-z][a-z-]*)(?: ([^{}\s]+))?\}\}$/;

/** The inline directive, the only way a number of the language appears in prose. */
export const INLINE_LIMIT = /\{\{limit ([A-Z_]+)\}\}/g;
/** A label of the app as the app shows it in the page's language: {{label tapToPlay}}. */
export const INLINE_LABEL = /\{\{label ([A-Za-z]+)\}\}/g;
/** Directives written inside a sentence, never as a block. */
export const INLINE_DIRECTIVES: ReadonlySet<string> = new Set(["limit", "label"]);
