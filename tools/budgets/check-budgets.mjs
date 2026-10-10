// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Weight budgets of the app, measured on the Vite manifest.
// Usage: node tools/budgets/check-budgets.mjs apps/web/dist
// Initial JS = the index.html entry file plus its static imports, recursively
// (dynamic imports and assets excluded: worker and worklet are assets).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const KB = 1024;
/**
 * 60 KB until the translation layer, 64 KB with it, 68 KB with the play range: each
 * revised with measurement.
 */
const INITIAL_JS_LIMIT = 68 * KB;
const WASM_LIMIT = 150 * KB;
/**
 * Export client (the lazy chunk of @untzel/export) plus the export worker, without WASM.
 * 120 KB: the video is the screen, so the worker carries the same
 * scene pipeline as the stage (families, composer, scene placement, the WebGL2 passes).
 */
const EXPORT_LIMIT = 120 * KB;
const EXPORT_CLIENT_SRC = "../../packages/export/src/index.ts";
const BOOT_SRC = "src/boot.ts";
// Mediabunny names its codec registry in its errors; the Lezer tables list the node names.
// Each marker has a positive control: it must still match somewhere in dist (the export
// worker, the boot chunk), or a renamed library would make the guard pass forever.
const MEDIABUNNY_MARKER = "Mediabunny";
const PARSER_MARKER = "TempoStatement";
/** Each sample pack (Opus), fetched only when a text uses its instrument. */
const SAMPLE_PACK_LIMIT = 1_500_000;
/** The boot chunk with the 44 manifests. */
const BOOT_LIMIT = 80 * KB;
// Markers of code that exists only in dev and test builds: the test hooks, the page
// simulation flags and the fake-session mount.
// "exportLab" is the MP4 and WAV reader of the export tests (apps/web/src/testing/).
// "untzelDemo" is the ?demo page of pnpm demo record.
const DEV_ONLY = ["untzelTest", "untzelPageFlags", "untzelPreview", "exportLab", "untzelDemo"];
// The take codec's format name. Only pnpm demo and pnpm sim record and render takes;
// the app has no Record, so no production chunk holds it.
const TAKE_MARKER = "untzel-take";
// The license notices the build ships (THIRD_PARTY.md, "Bundled libraries"): one library of
// the editor, one of the language and the export worker's, which Vite alone would miss.
const LICENSE_FILE = "third-party-licenses.md";
const LICENSED_LIBRARIES = ["@codemirror/view", "@lezer/lr", "mediabunny"];
// Development packages: no production chunk may come from them, even a lazy one.
const DEV_SOURCES = /(^|\/)(apps\/ui-preview|ui-preview|tools|src\/testing)\//;

const dist = resolve(process.argv[2] ?? "apps/web/dist");
const manifest = JSON.parse(readFileSync(join(dist, ".vite/manifest.json"), "utf8"));

const gzipSize = (file) => gzipSync(readFileSync(join(dist, file)), { level: 9 }).length;

function initialFiles(key, seen = new Set()) {
  const chunk = manifest[key];
  if (!chunk || seen.has(chunk.file)) return seen;
  seen.add(chunk.file);
  for (const imported of chunk.imports ?? []) initialFiles(imported, seen);
  return seen;
}

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

const initial = [...initialFiles("index.html")];
const initialJs = initial.reduce((sum, file) => sum + gzipSize(file), 0);
const contains = (files, marker) => files.filter((file) => readFileSync(join(dist, file), "utf8").includes(marker));
// The export: its client chunk, the chunks only it imports, and the worker file (an asset).
const exportClient = manifest[EXPORT_CLIENT_SRC];
const bootStatic = initialFiles(BOOT_SRC);
const exportFiles = exportClient === undefined ? [] : [...initialFiles(EXPORT_CLIENT_SRC)].filter((file) => file === exportClient.file || !bootStatic.has(file));
const exportWorkers = listFiles(join(dist, "assets"))
  .filter((path) => /export\.worker-[^/]+\.js$/.test(path))
  .map((path) => path.slice(dist.length + 1));
const exportJs = [...exportFiles, ...exportWorkers].reduce((sum, file) => sum + gzipSize(file), 0);
const mediabunnyStatic = contains([...new Set([...initial, ...bootStatic])], MEDIABUNNY_MARKER);
const parserInitial = contains(initial, PARSER_MARKER);
const scriptFiles = listFiles(dist)
  .filter((path) => path.endsWith(".js"))
  .map((path) => path.slice(dist.length + 1));
const staleMarkers = [
  { marker: MEDIABUNNY_MARKER, where: exportWorkers },
  { marker: PARSER_MARKER, where: scriptFiles },
].filter(({ marker, where }) => contains(where, marker).length === 0);
const licenseText = existsSync(join(dist, LICENSE_FILE)) ? readFileSync(join(dist, LICENSE_FILE), "utf8") : "";
const unlicensed = LICENSED_LIBRARIES.filter((name) => !licenseText.includes(`\n## ${name} - `));
const wasmFiles = listFiles(dist).filter((path) => path.endsWith(".wasm"));
const wasm = wasmFiles.reduce(
  (sum, path) => sum + gzipSync(readFileSync(path), { level: 9 }).length,
  0,
);
const scripts = listFiles(dist).filter((path) => path.endsWith(".js"));
const devOnly = DEV_ONLY.map((marker) => ({
  marker,
  files: scripts.filter((path) => readFileSync(path, "utf8").includes(marker)).length,
}));
// Lazy chunks, reported for review (the editor and export load on demand).
const lazy = Object.values(manifest).filter((chunk) => chunk.isDynamicEntry && chunk.file.endsWith(".js"));

const devChunks = Object.entries(manifest).filter(([key, chunk]) => DEV_SOURCES.test(chunk.src ?? key));
// The boot chunk: session, language, audio and the manifests, loaded in the background.
const bootChunk = manifest[BOOT_SRC];
const boot = bootChunk === undefined ? 0 : gzipSize(bootChunk.file);
// Opus is already compressed: the packs are measured as served, not gzipped.
const samplePacks = listFiles(join(dist, "assets")).filter((path) => /pack-[^/]+\.opus$/.test(path));
// The editor loads when Code opens: its chunk and what it imports beyond the initial JS
// (124 KB). The chunk also carries the editor CSS, which used to be a separate file
// outside this count.
const EDITOR_LIMIT = 124 * KB;
// Code opens only after the engine (boot) runs, so what boot already loaded is not counted.
const dynamicKey = (name) => Object.keys(manifest).find((key) => manifest[key].isDynamicEntry && manifest[key].name === name);
const loadedBefore = new Set([...initialFiles("index.html"), ...initialFiles(dynamicKey("boot") ?? "")]);
const editorKey = dynamicKey("editor-mount");
const editorJs = editorKey === undefined
  ? Number.POSITIVE_INFINITY
  : [...initialFiles(editorKey)].filter((file) => !loadedBefore.has(file)).reduce((sum, file) => sum + gzipSize(file), 0);

const rows = [
  { item: "initial JS (gzip 9)", value: initialJs, limit: INITIAL_JS_LIMIT },
  { item: "editor JS, loaded with Code (gzip 9)", value: editorJs, limit: EDITOR_LIMIT },
  { item: "dsp WASM (gzip 9)", value: wasm, limit: WASM_LIMIT },
  { item: "export client + worker (gzip 9)", value: exportJs, limit: EXPORT_LIMIT },
  { item: "mediabunny in the initial JS or boot", value: mediabunnyStatic.length, limit: 0 },
  { item: "language parser in the initial JS", value: parserInitial.length, limit: 0 },
  { item: "boot chunk (gzip 9)", value: boot, limit: BOOT_LIMIT },
  { item: `"${TAKE_MARKER}" in production JS`, value: contains(scriptFiles, TAKE_MARKER).length, limit: 0 },
  ...devOnly.map(({ marker, files }) => ({ item: `"${marker}" in production JS`, value: files, limit: 0 })),
  { item: "chunks from ui-preview or tools", value: devChunks.length, limit: 0 },
  ...samplePacks.map((path) => ({ item: `sample pack ${path.slice(dist.length + 1)} (bytes)`, value: statSync(path).size, limit: SAMPLE_PACK_LIMIT })),
  { item: "sample packs in the initial JS", value: contains(initial, ".opus").length, limit: 0 },
  { item: `bundled libraries missing from ${LICENSE_FILE}`, value: unlicensed.length, limit: 0 },
];

let failed = wasmFiles.length === 0 || exportWorkers.length === 0 || exportClient === undefined || staleMarkers.length > 0;
for (const { marker } of staleMarkers) console.error(`marker "${marker}" is stale: it matches no file in dist.`);
if (wasmFiles.length === 0) console.error("No .wasm file in dist.");
if (exportWorkers.length === 0 || exportClient === undefined) console.error("No export client or export worker in dist.");
for (const row of rows) {
  const ok = row.value <= row.limit;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"}  ${row.item}: ${row.value} (limit ${row.limit})`);
}
for (const [key] of devChunks) console.error(`dev-only chunk in production: ${key}`);
for (const name of unlicensed) console.error(`${LICENSE_FILE} has no section for ${name}`);
for (const chunk of lazy) console.log(`info  lazy ${chunk.name ?? chunk.file} (gzip 9): ${gzipSize(chunk.file)}`);
console.log(`${failed ? "FAIL" : "PASS"}  budgets`);
process.exit(failed ? 1 : 0);
