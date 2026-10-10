// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A template says how the picker shows it in comment lines at its top:
//   // template: Sunday Piano
//   // order: 1
// and the one template that plays on the first tap also says
//   // default: true
// A new template is one .untzel file with this header.

export interface TemplateHeader {
  /** The project name the picker card reads. */
  readonly name: string;
  /** Position inside its style, 1 first (0 for a template at the root). */
  readonly order: number;
  /** The template the first touch opens. */
  readonly isDefault: boolean;
}

// One unambiguous capture, trimmed after: "\s*(\S.*?)\s*$" backtracked over long runs of spaces.
const NAME = /^\/\/[ \t]*template:(.*)$/m;
const ORDER = /^\/\/\s*order:\s*(\d+)\s*$/m;
const DEFAULT = /^\/\/\s*default:\s*true\s*$/m;

/** The header of a template text, or null when a line is missing. */
export function parseTemplateHeader(text: string): TemplateHeader | null {
  const name = NAME.exec(text)?.[1]?.trim();
  const order = ORDER.exec(text)?.[1];
  if (name === undefined || name === "" || order === undefined) return null;
  return { name, order: Number(order), isDefault: DEFAULT.test(text) };
}
