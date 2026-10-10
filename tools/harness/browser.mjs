#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// pnpm test:browser [--measure | --engines] [-- <playwright args>]
//   --measure runs the timing measurements of the engine instead of the smoke tests:
//   first-sound, scale, swap-under-load and the 10-minute drift run (UNTZEL_DRIFT_SECONDS
//   shortens it), the export ones (export-while-playing, export-long), one at a time, the
//   scene's frame work with 64 tracks (stress-64) and the take ones. Test files after `--`
//   replace that list:
//   `--measure -- parallel/engine/first-sound.browser.ts --repeat-each=3` runs only first-sound.
//   --engines runs the export codec paths in Playwright's WebKit and Firefox (installed
//   with `npx playwright install webkit firefox`), with a clean environment for Firefox.
// Without flags: the "chrome" project in parallel, then the "timing" project and the
// "solo" project (the exports), each one test at a time, in that order.
// Builds the test bundle, serves it with vite preview on a free port with the production
// Content-Security-Policy (static, no nonce; app-content-security-policy.mjs), runs the
// Playwright tests in the installed Chrome, then the tests of the public docs (tools/docs,
// served under /docs/ with the production CSP), and writes .cache/screenshots/index.html, a
// contact sheet of every capture.

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { preview } from "vite";
import { APP_CONTENT_SECURITY_POLICY } from "./app-content-security-policy.mjs";
import { REPO, run, step, summarize } from "./lib.mjs";
import { ensureWasm } from "./wasm.mjs";

const WEB = join(REPO, "apps/web");
const SCREENSHOTS = join(REPO, ".cache/screenshots");
const WIDTHS = [390, 768, 1024, 1440];
// Paths inside the suite of the composition's skin (tests/skins/<skin>/); Playwright matches them
// against the end of the file path, within the files the config's testMatch selects.
// take-while-playing and take-render: what Record costs while playing and when a take is rendered.
const MEASUREMENTS = ["parallel/engine/first-sound", "parallel/engine/scale", "parallel/engine/swap-under-load", "parallel/engine/drift", "solo/export-measure", "parallel/engine/stress-64", "parallel/engine/take-while-playing", "parallel/engine/take-render"].map((name) => `${name}.browser.ts`);
const argv = process.argv.slice(2);
const measure = argv.includes("--measure");
const engines = argv.includes("--engines");
const separator = argv.indexOf("--");
const extra = separator < 0 ? [] : argv.slice(separator + 1);
/** Test files named after `--` (positional, not a flag value); --measure runs only those. */
const named = extra.filter((arg, index) => arg.endsWith(".browser.ts") && !(extra[index - 1] ?? "").startsWith("-"));

function contactSheet() {
  const files = existsSync(SCREENSHOTS) ? readdirSync(SCREENSHOTS).filter((file) => file.endsWith(".png")) : [];
  const states = [...new Set(files.map((file) => file.replace(/-\d+\.png$/, "")))].sort();
  const rows = states
    .map((state) => {
      const cells = WIDTHS.map((width) => {
        const file = `${state}-${width}.png`;
        return files.includes(file)
          ? `<figure><a href="${file}"><img src="${file}" alt="${state} at ${width} px" loading="lazy"></a><figcaption>${width}</figcaption></figure>`
          : `<figure class="missing"><figcaption>${width}: none</figcaption></figure>`;
      }).join("");
      return `<section><h2>${state}</h2><div class="row">${cells}</div></section>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Untzel · screenshots</title>
<style>
body{margin:24px;background:#0b0b0c;color:#fff;font:14px/1.4 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}
p{color:#aaa5a1;margin:0 0 16px}.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}
figure{margin:0}img{display:block;height:360px;width:auto;border:1px solid #26282d;background:#161719}
figcaption{color:#aaa5a1;font-size:12px;margin-top:4px}.missing{width:120px;height:360px;border:1px dashed #26282d}
</style></head><body>
<h1>Untzel screenshots</h1>
<p>${files.length} captures, ${new Date().toISOString()}. Full page at 390×844, 768×1024, 1024×768 and 1440×900.</p>
${rows}
</body></html>
`;
  writeFileSync(join(SCREENSHOTS, "index.html"), html);
  return `${files.length} captures, ${states.length} states → .cache/screenshots/index.html`;
}

/**
 * vite preview gzips JS and CSS but sends the WASM raw (82 KB instead of 33 KB). The site
 * must serve it compressed; so does this server, or the
 * first-sound measurement under Slow 4G would time a download production never makes.
 */
function compressWasm() {
  // Compressed once per file, as a CDN serves it: gzip 9 of the 360 KB WASM blocks this
  // one-threaded server for ~0.1 s, and every request of the first screen waited behind it
  // once the HTML preloads the WASM (measured).
  const compressed = new Map();
  return {
    name: "untzel-compress-wasm",
    configurePreviewServer(server) {
      const assets = join(WEB, "dist-test/assets");
      for (const name of readdirSync(assets).filter((entry) => entry.endsWith(".wasm"))) {
        compressed.set(join(assets, name), gzipSync(readFileSync(join(assets, name)), { level: 9 }));
      }
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? "").split("?")[0] ?? "";
        if (!path.endsWith(".wasm") || !/\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""))) return next();
        const file = join(WEB, "dist-test", path);
        if (!existsSync(file)) return next();
        const body = compressed.get(file) ?? gzipSync(readFileSync(file), { level: 9 });
        compressed.set(file, body);
        response.writeHead(200, { "content-type": "application/wasm", "content-encoding": "gzip", "content-length": body.length, "cache-control": "no-cache" });
        response.end(body);
      });
    },
  };
}

// Over 40 lines: the harness's steps in their order (WASM, build, preview, suite, report); a failed step stops the next.
async function main() {
  const startedAt = performance.now();
  // Measurements take no screenshots: keep the last contact sheet.
  if (!measure && !engines) rmSync(SCREENSHOTS, { recursive: true, force: true });
  mkdirSync(SCREENSHOTS, { recursive: true });
  const results = [await step("wasm", async () => (await ensureWasm()).detail)];
  results.push(await run("build --mode test", join(WEB, "node_modules/.bin/vite"), ["build", "--mode", "test"], { cwd: WEB }));
  if (results.every((result) => result.ok)) {
    const server = await preview({
      root: WEB,
      mode: "test",
      logLevel: "error",
      plugins: [compressWasm()],
      preview: { port: 0, host: "127.0.0.1", strictPort: false, headers: { "content-security-policy": APP_CONTENT_SECURITY_POLICY } },
    });
    const url = server.resolvedUrls?.local[0];
    const playwright = join(WEB, "node_modules/.bin/playwright");
    const env = { UNTZEL_BASE_URL: url, UNTZEL_SCREENSHOTS: SCREENSHOTS };
    try {
      if (measure) {
        results.push(await run("playwright (measure)", playwright, ["test", ...(named.length > 0 ? [] : MEASUREMENTS), "--workers=1", ...extra], { cwd: WEB, env: { ...env, UNTZEL_MEASURE: "1" }, stream: true }));
      } else if (engines) {
        // Firefox fails to start with this shell's environment: only what it needs.
        const clean = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env, UNTZEL_ENGINES: "1" };
        results.push(await run("playwright (engines)", playwright, ["test", "--project=webkit", "--project=firefox", ...extra], { cwd: WEB, env: clean, cleanEnv: true, stream: true }));
      } else {
        results.push(await run("playwright", playwright, ["test", "--project=chrome", "--pass-with-no-tests", ...extra], { cwd: WEB, env, stream: true }));
        results.push(await run("playwright (timing)", playwright, ["test", "--project=timing", "--pass-with-no-tests", ...extra], { cwd: WEB, env, stream: true }));
        results.push(await run("playwright (solo)", playwright, ["test", "--project=solo", "--pass-with-no-tests", ...extra], { cwd: WEB, env, stream: true }));
      }
    } finally {
      await server.close();
    }
    if (!measure && !engines) {
      results.push(
        await run("playwright (docs)", process.execPath, [join(REPO, "tools/docs/bin/docs.mjs"), "browser"], {
          env: { UNTZEL_SCREENSHOTS: SCREENSHOTS },
          stream: true,
        }),
      );
      results.push(await step("contact sheet", async () => contactSheet()));
    }
  }
  const title = measure ? "pnpm test:browser --measure" : engines ? "pnpm test:browser --engines" : "pnpm test:browser";
  process.exit(summarize(title, results, startedAt));
}

await main();
