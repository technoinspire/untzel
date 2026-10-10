// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm docs:check: a full build in .cache/docs/site, then every drift check. Fails loudly,
// with the whole list, never only the first problem.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promptSection } from "./ai/llms";
import { buildDocs, type BuildResult } from "./build";
import { measureBudgets, type Measure } from "./checks/budgets";
import { checkCreditCoverage } from "./checks/credits";
import { checkExamples, checkParity } from "./checks/examples";
import {
  checkAppLinks,
  checkFonts,
  checkForbidden,
  checkHeadings,
  checkLinks,
  checkSnippets,
  listFiles,
  untzelBlocks,
  untzelFences,
} from "./checks/output";
import { checkDiagnosticReference, checkFeatureMarks, checkInstrumentReference, checkShortcutReference } from "./checks/references";
import { unescapeHtml } from "./render/html";

export const GENERATED = ["llms.txt", "llms-full.txt"] as const;

export interface CheckReport {
  readonly failures: readonly string[];
  readonly budgets: readonly Measure[];
  readonly files: number;
}

function generatedFailures(result: BuildResult, repo: string): string[] {
  const contents = { "llms.txt": result.llms, "llms-full.txt": result.llmsFull };
  return GENERATED.flatMap((name) => {
    const committed = join(repo, "apps/docs/generated", name);
    const current = existsSync(committed) ? readFileSync(committed, "utf8") : "";
    return current === contents[name] ? [] : [`apps/docs/generated/${name} is out of date: run \`pnpm docs:build --write-generated\` and commit`];
  });
}

function promptFailures(result: BuildResult): string[] {
  const failures: string[] = [];
  if (promptSection(result.llmsFull) !== result.data.prompt) failures.push("llms-full.txt: the ## Prompt section differs from the prompt");
  for (const page of result.pages.filter((candidate) => candidate.id === "ai")) {
    const shown = /<pre class="prompt__text" id="ai-prompt" lang="en">([\s\S]*?)<\/pre>/.exec(page.body)?.[1];
    if (shown === undefined || unescapeHtml(shown) !== result.data.prompt) failures.push(`${page.path}: the #ai-prompt block differs from the prompt`);
  }
  return failures;
}

export async function checkDocs(repo: string): Promise<CheckReport> {
  const root = join(repo, ".cache/docs/site");
  const result = await buildDocs(repo, root);
  if (result.errors.length > 0) return { failures: result.errors, budgets: [], files: 0 };
  const files = listFiles(root);
  const read = (file: string): string => readFileSync(join(root, file), "utf8");
  const { sources } = result.data;
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const failures = [
    ...checkExamples(result),
    ...checkParity(result),
    ...checkForbidden(root, files),
    ...htmlFiles.flatMap((file) => checkHeadings(file, read(file))),
    ...checkLinks(root, files),
    ...checkAppLinks(files, read),
    ...htmlFiles.flatMap((file) => checkSnippets(file, untzelBlocks(read(file)), sources)),
    ...checkSnippets("llms.txt", untzelFences(result.llms), sources),
    ...checkSnippets("llms-full.txt", untzelFences(result.llmsFull), sources),
    ...checkSnippets("the prompt", untzelFences(result.data.prompt), sources),
    ...checkFonts(root, files, repo),
    ...checkInstrumentReference(result.pages, sources),
    ...checkDiagnosticReference(result.pages),
    ...checkShortcutReference(result.pages),
    ...checkFeatureMarks(result.pages, result.data.features),
    ...checkCreditCoverage(repo, sources.credits),
    ...generatedFailures(result, repo),
    ...promptFailures(result),
  ];
  const budgets = measureBudgets(root, files, result.data.prompt);
  failures.push(...budgets.filter((measure) => measure.bytes > measure.limit).map((measure) => `budget: ${measure.what} is ${measure.bytes}, limit ${measure.limit}`));
  return { failures, budgets, files: files.length };
}
