// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// node tools/docs/bin/docs.mjs <build|check|dev|serve|browser> [--out dir] [--write-generated] [--port n]
//   build    writes apps/docs/dist (or --out); --write-generated also rewrites apps/docs/generated/llms*.txt
//   check    full build in .cache/docs/site and every drift check (pnpm docs:check)
//   dev      build, serve under /docs/ with the production CSP, rebuild on change
//   serve    serve an existing build (--out) without building
//   browser  build, serve, and run the Playwright tests of apps/docs in the installed Chrome
import { spawn } from "node:child_process";
import { watch, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { buildDocs, type BuildResult } from "./build";
import { checkDocs } from "./check";
import { serveDocs } from "./serve";

export interface CliEnvironment {
  readonly repo: string;
}

function option(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index < 0 ? null : (args[index + 1] ?? null);
}

function outDir(args: readonly string[], repo: string, fallback: string): string {
  const out = option(args, "--out") ?? fallback;
  return isAbsolute(out) ? out : join(repo, out);
}

function report(result: BuildResult, started: number, out: string): number {
  for (const warning of result.warnings) console.warn(`docs: warning: ${warning}`);
  if (result.errors.length > 0) {
    console.error(`docs: FAIL, ${result.errors.length} problem(s):`);
    for (const error of result.errors) console.error(`  ${error}`);
    return 1;
  }
  console.log(`docs: built ${result.pages.length} pages in ${Math.round(performance.now() - started)} ms → ${out}`);
  return 0;
}

async function build(args: readonly string[], repo: string): Promise<number> {
  const started = performance.now();
  const out = outDir(args, repo, "apps/docs/dist");
  const result = await buildDocs(repo, out);
  if (result.errors.length === 0 && args.includes("--write-generated")) {
    writeFileSync(join(repo, "apps/docs/generated/llms.txt"), result.llms);
    writeFileSync(join(repo, "apps/docs/generated/llms-full.txt"), result.llmsFull);
    console.log("docs: rewrote apps/docs/generated/llms.txt and llms-full.txt");
  }
  return report(result, started, out);
}

async function check(repo: string): Promise<number> {
  const started = performance.now();
  const { failures, budgets, files } = await checkDocs(repo);
  for (const measure of budgets) console.log(`  ${measure.bytes <= measure.limit ? "ok  " : "OVER"} ${measure.what}: ${measure.bytes} / ${measure.limit}`);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  if (failures.length > 0) {
    console.error(`docs:check FAIL, ${failures.length} problem(s), ${seconds} s:`);
    for (const failure of failures) console.error(`  ${failure}`);
    return 1;
  }
  console.log(`docs:check PASS: ${files} files, ${seconds} s`);
  return 0;
}

async function dev(args: readonly string[], repo: string): Promise<number> {
  const out = outDir(args, repo, "apps/docs/dist");
  const rebuild = async (): Promise<void> => {
    const started = performance.now();
    report(await buildDocs(repo, out), started, out);
  };
  await rebuild();
  const { url } = await serveDocs(out, Number(option(args, "--port") ?? 0));
  console.log(`docs: serving ${url} (reload the page after a change)`);
  let pending: NodeJS.Timeout | null = null;
  const schedule = (): void => {
    if (pending !== null) clearTimeout(pending);
    pending = setTimeout(() => void rebuild(), 200);
  };
  for (const folder of ["apps/docs/content", "apps/docs/examples", "apps/docs/src", "apps/web/src/templates", "instruments", "packages/language/src"]) {
    watch(join(repo, folder), { recursive: true }, schedule);
  }
  return new Promise(() => undefined);
}

async function serve(args: readonly string[], repo: string): Promise<number> {
  const { url } = await serveDocs(outDir(args, repo, "apps/docs/dist"), Number(option(args, "--port") ?? 0));
  console.log(`docs: serving ${url}`);
  return new Promise(() => undefined);
}

async function browser(args: readonly string[], repo: string): Promise<number> {
  const out = join(repo, ".cache/docs/browser");
  const started = performance.now();
  const result = await buildDocs(repo, out);
  if (report(result, started, out) !== 0) return 1;
  const { server, url } = await serveDocs(out);
  const extra = args.includes("--") ? args.slice(args.indexOf("--") + 1) : [];
  try {
    return await new Promise<number>((resolve) => {
      const child = spawn(join(repo, "apps/docs/node_modules/.bin/playwright"), ["test", ...extra], {
        cwd: join(repo, "apps/docs"),
        env: { ...process.env, UNTZEL_DOCS_URL: url, UNTZEL_SCREENSHOTS: process.env["UNTZEL_SCREENSHOTS"] ?? join(repo, ".cache/screenshots/docs") },
        stdio: "inherit",
      });
      child.on("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    server.close();
  }
}

export async function main(argv: readonly string[], environment: CliEnvironment): Promise<number> {
  const [command, ...args] = argv;
  switch (command) {
    case "build":
      return build(args, environment.repo);
    case "check":
      return check(environment.repo);
    case "dev":
      return dev(args, environment.repo);
    case "serve":
      return serve(args, environment.repo);
    case "browser":
      return browser(args, environment.repo);
    default:
      console.error("usage: docs.mjs <build|check|dev|serve|browser> [--out dir] [--write-generated] [--port n]");
      return 2;
  }
}
