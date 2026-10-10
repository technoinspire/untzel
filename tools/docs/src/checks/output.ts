// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Checks on the built folder, whatever produced it: links and anchors, headings, every
// Untzel snippet, forbidden markup for the CSP, the app link and the bundled fonts.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { analyze, type Diagnostic } from "@untzel/language";
import { textOf } from "../render/html";
import { APP_URL } from "../content/site";
import type { DocsSources } from "../content/sources";

export function listFiles(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split("\\").join("/"))
    .filter((entry) => statSync(join(root, entry)).isFile())
    .sort();
}

const FORBIDDEN: readonly (readonly [RegExp, string, RegExp])[] = [
  [/\sstyle=/, "a style attribute (CSP style-src 'self')", /\.html$/],
  [/<script(?![^>]*\ssrc=)[^>]*>/, "an inline script", /\.html$/],
  // In a page, only a data: URL that loads something counts: the app's CSP quoted as text
  // on developers#hosting names the scheme without using it.
  [/(?:\b(?:src|href|srcset|poster)=["']?|url\(\s*["']?)data:/i, "a data: URL", /\.html$/],
  [/\bdata:/, "a data: URL", /\.(css|js)$/],
  [/http:\/\//, "an http: URL", /\.(html|css|js|json|txt)$/],
  // Untzel's own repositories are private; third-party sources on GitHub (the recorded
  // instruments of credits.json) are public and their credit links to them.
  [/github\.com[/:]technoinspire\b/i, "a link to Techno Inspire's GitHub (the repository is private)", /\.(html|css|js|json|txt|xml)$/],
];

export function checkForbidden(root: string, files: readonly string[]): string[] {
  const failures: string[] = [];
  if (files.some((file) => file.startsWith(".vite/") || file.includes("/.vite/"))) failures.push(".vite/ is in the output");
  for (const file of files) {
    // The SIL Open Font License texts are the font authors' own, with their links.
    if (/^fonts\/OFL-[A-Za-z-]+\.txt$/.test(file)) continue;
    const text = readFileSync(join(root, file), "utf8");
    for (const [pattern, what, applies] of FORBIDDEN) {
      if (applies.test(file) && pattern.test(text)) failures.push(`${file}: ${what}`);
    }
  }
  return failures;
}

export function checkHeadings(file: string, document: string): string[] {
  const levels = [...document.matchAll(/<h([1-6])[\s>]/g)].map((match) => Number(match[1]));
  const failures: string[] = [];
  if (levels.filter((level) => level === 1).length !== 1) failures.push(`${file}: needs exactly one h1`);
  levels.forEach((level, index) => {
    const previous = levels[index - 1] ?? 0;
    if (level > previous + 1) failures.push(`${file}: h${level} after h${previous} skips a level`);
  });
  return failures;
}

function idsOf(document: string): ReadonlySet<string> {
  return new Set([...document.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1] ?? ""));
}

/** Every relative href and src resolves to a built file, and every #anchor to an id there. */
export function checkLinks(root: string, files: readonly string[]): string[] {
  const failures: string[] = [];
  const documents = new Map(files.filter((file) => file.endsWith(".html")).map((file) => [file, readFileSync(join(root, file), "utf8")] as const));
  for (const [file, document] of documents) {
    const withoutApp = document.replace(/<a [^>]*data-app-link[^>]*>/g, "");
    for (const match of withoutApp.matchAll(/\s(?:href|src)="([^"]*)"/g)) {
      const reference = match[1] ?? "";
      if (/^https:\/\//.test(reference)) continue;
      const [path = "", hash] = reference.split("#");
      let target = path === "" ? file : relative(root, join(root, dirname(file), path)).split("\\").join("/");
      if (path.endsWith("/") || path === "." || path === "./") target = `${target === "" ? "" : `${target.replace(/\/$/, "")}/`}index.html`;
      if (target.startsWith("..")) {
        failures.push(`${file}: ${reference} leaves the docs`);
        continue;
      }
      if (!existsSync(join(root, target))) {
        failures.push(`${file}: ${reference} → ${target} does not exist`);
        continue;
      }
      if (hash !== undefined && hash !== "" && !idsOf(documents.get(target) ?? "").has(hash)) failures.push(`${file}: ${reference} → no id "${hash}" in ${target}`);
    }
  }
  return failures;
}

/** The app link of every page is the app's own origin, app.untzel.com. */
export function checkAppLinks(files: readonly string[], read: (file: string) => string): string[] {
  const failures: string[] = [];
  for (const file of files.filter((candidate) => candidate.endsWith(".html"))) {
    const href = /<a [^>]*href="([^"]+)"[^>]*data-app-link/.exec(read(file))?.[1];
    if (href !== APP_URL) failures.push(`${file}: the app link ${href ?? "(none)"} is not ${APP_URL}`);
  }
  return failures;
}

export function untzelBlocks(document: string): readonly string[] {
  return [...document.matchAll(/<pre class="untzel"[^>]*><code>([\s\S]*?)<\/code><\/pre>/g)].map((match) => textOf(match[1] ?? ""));
}

export function untzelFences(text: string): readonly string[] {
  return [...text.matchAll(/^```untzel\n([\s\S]*?)\n```$/gm)].map((match) => match[1] ?? "");
}

function firstProblem(text: string, sources: DocsSources): Diagnostic | null {
  const result = analyze(text, sources.built.registry);
  const found = result.ok ? result.warnings : result.diagnostics;
  if (found.length === 0) return null;
  for (const [id, example] of sources.examples) {
    if (id.startsWith("errors/") && example.text === text && found[0]?.code === id.slice("errors/".length)) return null;
  }
  return found[0] ?? null;
}

/** Each snippet must analyze clean, or be an error example byte for byte and give its code. */
export function checkSnippets(where: string, snippets: readonly string[], sources: DocsSources): string[] {
  return snippets.flatMap((snippet, index) => {
    const problem = firstProblem(snippet, sources);
    return problem === null ? [] : [`${where}, snippet ${index + 1}: ${problem.code} ${problem.message}\n${snippet.split("\n").map((line) => `    ${line}`).join("\n")}`];
  });
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** The fonts in the output are the app's files, byte for byte. */
export function checkFonts(root: string, files: readonly string[], repo: string): string[] {
  const failures: string[] = [];
  for (const font of ["jost-normal-400-latin", "hanken-grotesk-400-600-latin"]) {
    const built = files.filter((file) => file.startsWith("assets/") && file.includes(font) && file.endsWith(".woff2"));
    const original = sha256(join(repo, "apps/web/public/fonts", `${font}.woff2`));
    if (built.length !== 1) failures.push(`expected one ${font}.woff2 in assets/, found ${built.length}`);
    else if (sha256(join(root, built[0] ?? "")) !== original) failures.push(`${built[0]}: differs from apps/web/public/fonts/${font}.woff2`);
  }
  return failures;
}
