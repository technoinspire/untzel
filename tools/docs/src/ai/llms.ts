// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// llms.txt (llmstxt.org) and llms-full.txt, from the English pages and the same prompt.
import { PAGE_IDS, type PageId } from "../../../../apps/docs/src/pages";
import { absoluteUrl, pagePath } from "../content/site";

export interface PageSummary {
  readonly id: PageId;
  readonly title: string;
  readonly description: string;
}

export const LLMS_SUMMARY =
  "Untzel is a music instrument in the browser by Techno Inspire: you tap to play a loop, then change it by touch or by editing a small text language that is analyzed, never executed.";

export const PROMPT_HEADING = "## Prompt";

export function llmsTxt(pages: readonly PageSummary[]): string {
  const docs = PAGE_IDS.map((id) => {
    const page = pages.find((candidate) => candidate.id === id);
    return `- [${page?.title ?? id}](${absoluteUrl(pagePath(id, "en"))}): ${page?.description ?? ""}`;
  });
  return `# Untzel

> ${LLMS_SUMMARY}

The text language has tracks, mini-notation patterns, modifiers, slow signals, sections and a song. The full reference below lists every instrument and parameter of this build, every limit and every error code, and ends with a prompt that teaches an assistant to write Untzel code for the Code panel of the app.

## Docs

${docs.join("\n")}

## Reference

- [Full reference for language models](${absoluteUrl("llms-full.txt")}): every page in English as Markdown, the instrument table, the error table, the examples and the prompt.

## Optional

- [Documentação em português](${absoluteUrl("")}): the same pages in Brazilian Portuguese.
- [The app](https://app.untzel.com/): Untzel itself.
`;
}

export interface FullPage {
  readonly id: PageId;
  readonly markdown: string;
}

export function llmsFullTxt(pages: readonly FullPage[], prompt: string): string {
  const body = pages.map((page) => `${page.markdown}\n\nSource: ${absoluteUrl(pagePath(page.id, "en"))}`).join("\n\n");
  return `# Untzel: full reference

> ${LLMS_SUMMARY}

${body}

${PROMPT_HEADING}

${prompt}`;
}

/** The text of the ## Prompt section, for the check that it equals the page prompt. */
export function promptSection(full: string): string {
  const start = full.indexOf(`\n${PROMPT_HEADING}\n\n`);
  return start < 0 ? "" : full.slice(start + PROMPT_HEADING.length + 3);
}
