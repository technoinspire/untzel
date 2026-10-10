// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every example analyzes as declared, every example is cited, every error code has one,
// and every node type of the grammar appears in some rendered example.
import { DIAGNOSTIC_CODES, GRAMMAR_NODE_TYPES, analyze, syntaxNodeTypes, type Diagnostic } from "@untzel/language";
import { EXAMPLE_REQUIREMENTS } from "../../../../apps/docs/src/features";
import { PROMPT_ERROR_EXAMPLES, PROMPT_EXAMPLES } from "../ai/prompt";
import type { BuildResult } from "../build";
import type { DocsSources } from "../content/sources";

const SYNTHETIC = new Set(["SOURCE_TOO_LONG", "INTERNAL_ERROR"]);

function diagnostics(text: string, sources: DocsSources): readonly Diagnostic[] {
  const result = analyze(text, sources.built.registry);
  return result.ok ? result.warnings : result.diagnostics;
}

/** A position as the simulator prints it: file:line:column: CODE message. */
export function describe(file: string, text: string, diagnostic: Diagnostic): string {
  const before = text.slice(0, diagnostic.from).split("\n");
  return `${file}:${before.length}:${(before.at(-1)?.length ?? 0) + 1}: ${diagnostic.code} ${diagnostic.message}`;
}

function gated(id: string, result: BuildResult): boolean {
  const requirement = EXAMPLE_REQUIREMENTS[id];
  return requirement !== undefined && result.data.features.get(requirement) !== true;
}

export function checkExamples(result: BuildResult): string[] {
  const failures: string[] = [];
  const { sources } = result.data;
  const codes = new Set<string>(DIAGNOSTIC_CODES);
  for (const [id, example] of sources.examples) {
    if (gated(id, result)) continue;
    const found = diagnostics(example.text, sources);
    if (id.startsWith("errors/")) {
      const code = id.slice("errors/".length);
      if (!codes.has(code)) failures.push(`${example.file}: ${code} is not a diagnostic code`);
      else if (found[0]?.code !== code) failures.push(`${example.file}: expected ${code} first, got ${found[0] === undefined ? "no diagnostic" : describe(example.file, example.text, found[0])}`);
    } else {
      failures.push(...found.map((diagnostic) => describe(example.file, example.text, diagnostic)));
    }
  }
  const cited = new Set<string>([
    ...result.pages.flatMap((page) => page.examples),
    ...Object.values(PROMPT_EXAMPLES),
    ...PROMPT_ERROR_EXAMPLES.map((code) => `errors/${code}`),
  ]);
  for (const [id, example] of sources.examples) {
    if (!cited.has(id)) failures.push(`${example.file}: no page cites this example`);
  }
  for (const code of DIAGNOSTIC_CODES) {
    if (!SYNTHETIC.has(code) && !sources.examples.has(`errors/${code}`)) failures.push(`apps/docs/examples/errors/${code}.untzel is missing`);
  }
  const rendered = [...sources.examples].filter(([id]) => cited.has(id) && !gated(id, result)).map(([, example]) => example.text);
  const covered = new Set(rendered.flatMap((text) => [...syntaxNodeTypes(text)]));
  const missing = GRAMMAR_NODE_TYPES.filter((type) => !covered.has(type));
  if (missing.length > 0) failures.push(`grammar node types no rendered example shows: ${missing.join(", ")}`);
  return failures;
}

/** pt-BR pages cite the same headings, directives and examples as the English source, in order. */
export function checkParity(result: BuildResult): string[] {
  const failures: string[] = [];
  for (const page of result.pages.filter((candidate) => candidate.locale === "pt-BR" && !candidate.untranslated)) {
    const english = result.pages.find((candidate) => candidate.locale === "en" && candidate.id === page.id);
    if (english === undefined) continue;
    const shape = (headings: typeof page.headings): string => headings.map((heading) => `h${heading.level}#${heading.id}`).join(" ");
    const uses = (directives: typeof page.directives): string => directives.map((use) => `${use.name} ${use.argument ?? ""}`.trim()).join(" | ");
    if (shape(page.headings) !== shape(english.headings)) failures.push(`${page.source.file}: headings differ from ${english.source.file}\n  pt-BR: ${shape(page.headings)}\n  en:    ${shape(english.headings)}`);
    if (uses(page.directives) !== uses(english.directives)) failures.push(`${page.source.file}: directives differ from ${english.source.file}\n  pt-BR: ${uses(page.directives)}\n  en:    ${uses(english.directives)}`);
  }
  return failures;
}
