// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pnpm docs:build: every page in every locale, the client, the search indexes, the sitemap,
// the pages index (pages.json) and the llms files, written to a sibling staging
// folder and swapped in only when complete.
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createFormatters, LOCALES, type Locale } from "@untzel/i18n";
import { PAGE_IDS, type PageId } from "../../../apps/docs/src/pages";
import { buildPrompt } from "./ai/prompt";
import { llmsFullTxt, llmsTxt } from "./ai/llms";
import { buildClient } from "./content/client-build";
import { frameText, type BuildData, type RenderContext } from "./content/context";
import { appImportsOf, coreExportNames, evaluateFeatures } from "./content/features";
import { trusted } from "./render/html";
import { FAVICON_PATH, LOGO_PATH, renderDocument, type ClientAssets } from "./render/layout";
import { createMarkdown, renderMarkdown, type DirectiveUse, type Heading } from "./render/markdown";
import { pagesIndex } from "./content/pages-index";
import { plainMarkdown } from "./render/plain-markdown";
import { descriptionOf, searchEntries, type SearchEntry } from "./content/search-index";
import { absoluteUrl, pagePath } from "./content/site";
import { loadSources, type SourceFile } from "./content/sources";

export interface BuiltPage {
  readonly id: PageId;
  readonly locale: Locale;
  readonly path: string;
  readonly source: SourceFile;
  readonly untranslated: boolean;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly headings: readonly Heading[];
  readonly directives: readonly DirectiveUse[];
  readonly examples: readonly string[];
  /** The complete HTML document. */
  document: string;
}

export interface BuildResult {
  readonly data: BuildData;
  readonly pages: readonly BuiltPage[];
  readonly llms: string;
  readonly llmsFull: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

function context(data: BuildData, locale: Locale, path: string, file: string, errors: string[]): RenderContext {
  return { data, locale, text: frameText(locale), formatters: createFormatters(locale), path, file, errors, examples: [], codeIds: [] };
}

function renderPages(data: BuildData, errors: string[], warnings: string[]): BuiltPage[] {
  const md = createMarkdown();
  const pages: BuiltPage[] = [];
  for (const locale of LOCALES) {
    for (const id of PAGE_IDS) {
      const sources = data.sources.pages.get(id);
      if (sources === undefined) throw new Error(`page ${id} has no source`);
      const untranslated = locale === "pt-BR" && sources.ptBR === null;
      if (untranslated) warnings.push(`${sources.en.file}: no pt-BR translation; the pt-BR URL shows English`);
      const source = locale === "pt-BR" ? (sources.ptBR ?? sources.en) : sources.en;
      const path = pagePath(id, locale);
      const page = context(data, locale, path, source.file, errors);
      const rendered = renderMarkdown(md, source.text, page);
      const h1 = rendered.headings.filter((heading) => heading.level === 1);
      if (h1.length !== 1) errors.push(`${source.file}: a page has exactly one # heading, found ${h1.length}`);
      pages.push({
        id,
        locale,
        path,
        source,
        untranslated,
        title: h1[0]?.text ?? id,
        description: descriptionOf(rendered.html),
        body: rendered.html,
        headings: rendered.headings,
        directives: rendered.directives,
        examples: page.examples,
        document: "",
      });
    }
  }
  return pages;
}

function frame(data: BuildData, pages: readonly BuiltPage[], page: BuiltPage, assets: ClientAssets, errors: string[]): string {
  const titles = new Map(pages.filter((candidate) => candidate.locale === page.locale).map((candidate) => [candidate.id, candidate.title] as const));
  const render = context(data, page.locale, page.path, page.source.file, errors);
  return renderDocument(render, {
    id: page.id,
    title: page.title,
    description: page.description,
    body: trusted(page.body),
    untranslated: page.untranslated,
    assets,
    menuTitles: titles,
  });
}

function llmsFiles(data: BuildData, pages: readonly BuiltPage[], errors: string[]): { llms: string; llmsFull: string } {
  const english = pages.filter((page) => page.locale === "en");
  const llms = llmsTxt(english.map((page) => ({ id: page.id, title: page.title, description: page.description })));
  const full = english.map((page) => ({ id: page.id, markdown: plainMarkdown(page.source.text, context(data, "en", page.path, page.source.file, errors)) }));
  return { llms, llmsFull: llmsFullTxt(full, data.prompt) };
}

function sitemap(pages: readonly BuiltPage[]): string {
  const urls = pages.filter((page) => page.locale === "pt-BR").map((page) => {
    const links = LOCALES.map((locale) => `<xhtml:link rel="alternate" hreflang="${locale}" href="${absoluteUrl(pagePath(page.id, locale))}"/>`).join("");
    return LOCALES.map((locale) => `<url><loc>${absoluteUrl(pagePath(page.id, locale))}</loc>${links}</url>`).join("\n");
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

function write(root: string, path: string, content: string): void {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function copy(repo: string, from: string, root: string, to: string): void {
  mkdirSync(dirname(join(root, to)), { recursive: true });
  copyFileSync(join(repo, from), join(root, to));
}

function writeStatic(repo: string, staging: string): void {
  copy(repo, "brand/untzel/untzel-wordmark-dark.svg", staging, LOGO_PATH);
  copy(repo, "apps/web/public/favicon.svg", staging, FAVICON_PATH);
  copy(repo, "apps/web/public/fonts/OFL-Jost.txt", staging, "fonts/OFL-Jost.txt");
  copy(repo, "apps/web/public/fonts/OFL-Hanken-Grotesk.txt", staging, "fonts/OFL-Hanken-Grotesk.txt");
}

/** Renders everything in memory; writes nothing. */
export async function generate(repo: string): Promise<BuildResult> {
  const sources = loadSources(repo);
  const features = await evaluateFeatures({
    sources,
    coreExports: coreExportNames(),
    appImports: appImportsOf(repo, sources.webDependencies),
  });
  const data: BuildData = { sources, features, prompt: buildPrompt(sources) };
  const errors: string[] = [];
  const warnings: string[] = [];
  const pages = renderPages(data, errors, warnings);
  return { data, pages, ...llmsFiles(data, pages, errors), errors, warnings };
}

/** Builds into outDir: staging folder first, swapped in only when every file is written. */
export async function buildDocs(repo: string, outDir: string): Promise<BuildResult> {
  const result = await generate(repo);
  if (result.errors.length > 0) return result;
  const staging = `${outDir}.staging`;
  const scratch = `${outDir}.client`;
  rmSync(staging, { recursive: true, force: true });
  const assets = await buildClient(repo, scratch);
  mkdirSync(staging, { recursive: true });
  renameSync(join(scratch, "assets"), join(staging, "assets"));
  rmSync(scratch, { recursive: true, force: true });
  const errors = [...result.errors];
  for (const page of result.pages) {
    page.document = frame(result.data, result.pages, page, assets, errors);
    write(staging, `${page.path}index.html`, page.document);
  }
  for (const locale of LOCALES) {
    const entries: SearchEntry[] = result.pages.filter((page) => page.locale === locale).flatMap((page) => searchEntries(page.path, page.title, page.description, page.body));
    write(staging, `search.${locale}.json`, `${JSON.stringify(entries)}\n`);
  }
  write(staging, "llms.txt", result.llms);
  write(staging, "llms-full.txt", result.llmsFull);
  write(staging, "sitemap.xml", sitemap(result.pages));
  write(staging, "pages.json", pagesIndex(result.pages));
  writeStatic(repo, staging);
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  mkdirSync(dirname(outDir), { recursive: true });
  renameSync(staging, outDir);
  return { ...result, errors };
}
