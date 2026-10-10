#!/usr/bin/env node
// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The layout step of pnpm check: folder size, package entries, the
// shape of every skin, the composition's alias and what it imports from it, the suite and
// preview states of the skin the alias names, and the generated instrument index. Every check
// is a pure function of the file list.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { pathToFileURL } from "node:url";
import { generatedFiles, staleFiles } from "./generate-instruments.mjs";
import { REPO } from "./lib.mjs";
/** Changing this ceiling is a design decision: agree it in an issue first. */
export const CEILING = 15;
const SKINS = "packages/skins/";
const SKIN_ALIAS = /^workspace:@untzel\/skin-([a-z0-9-]+)@\*$/;
/** What the composition may import from @untzel/skin. */
export const COMPOSITION_IMPORTS = {
  "@untzel/skin": ["createShell", "addControlsTranslations"],
  "@untzel/skin/pt-BR": ["controlsPortuguese"],
};
/** The words the composition still reads from the skin. */
export const COMPOSITION_WORDS_FROM_SKIN = ["clockLabel", "exportCapNote", "capOf", "limitLabel", "partSpanNames", "tempoAndKey", "remixTitle", "copyTitle", "ATTRIBUTION", "liveStrings", "livePhrases", "rangePhrases", "strings"];
const STYLE_SHEETS = ["@untzel/skin/styles.css", "@untzel/skin/page.css"];
/** The files of the suite that the Playwright config and --measure name. */
export const SUITE_FILES = [
  "parallel/page/static-csp.browser.ts",
  "parallel/engine/first-sound.browser.ts",
  "parallel/engine/scale.browser.ts",
  "parallel/engine/swap-under-load.browser.ts",
  "parallel/engine/drift.browser.ts",
  "parallel/engine/stress-64.browser.ts",
  "solo/export-measure.browser.ts",
];
const isProductionModule = (path) => /\.(ts|mjs)$/.test(path) && !/\.(test|browser)\.ts$|\.test\.mjs$|\.d\.ts$/.test(path) && !path.includes("/generated/");
const isPackageJson = (path) => path.endsWith("/package.json");
const countBy = (paths) => {
  const counts = new Map();
  for (const path of paths) counts.set(posix.dirname(path), (counts.get(posix.dirname(path)) ?? 0) + 1);
  return counts;
};
/** No folder above the ceiling of production modules or of browser tests. */
export function folderProblems(files) {
  const problems = [];
  const modules = files.filter((path) => /^(packages|apps|tools)\//.test(path) && isProductionModule(path));
  for (const [dir, count] of countBy(modules)) if (count > CEILING) problems.push(`${dir} has ${count} production modules (ceiling ${CEILING}): split it by subdomain`);
  const browserTests = files.filter((path) => /^apps\/[^/]+\/tests\/.*\.browser\.ts$/.test(path));
  for (const [dir, count] of countBy(browserTests)) if (count > CEILING) problems.push(`${dir} has ${count} browser tests (ceiling ${CEILING})`);
  return problems;
}
const exportTarget = (value) => (typeof value === "string" ? value : value?.default ?? value?.import ?? value?.types);
/**
 * Every package of packages/ has exports that exist, and ./testing when it has src/testing/.
 * `exists` also knows build outputs outside git (the DSP's WASM, built by the wasm step first).
 */
export function packageProblems(files, read, exists = () => false) {
  const problems = [];
  const listed = new Set(files);
  for (const file of files.filter((path) => path.startsWith("packages/") && isPackageJson(path))) {
    const dir = posix.dirname(file);
    const json = JSON.parse(read(file));
    if (json.exports === undefined) {
      problems.push(`${dir}: package.json has no exports`);
      continue;
    }
    for (const [subpath, value] of Object.entries(json.exports)) {
      const target = posix.join(dir, exportTarget(value) ?? "");
      if (!listed.has(target) && !exists(target)) problems.push(`${dir}: ${subpath} points to ${target}, which does not exist`);
    }
    const hasTesting = files.some((path) => path.startsWith(`${dir}/src/testing/`));
    if (hasTesting && json.exports["./testing"] === undefined) problems.push(`${dir}: has src/testing/ but no ./testing export`);
  }
  for (const file of files.filter(isPackageJson)) if (JSON.parse(read(file)).name === "@untzel/skin") problems.push(`${file}: the name @untzel/skin is the composition's alias, never a package`);
  return problems;
}
/** The skin folders of packages/skins/. */
export const skinsOf = (files) => [...new Set(files.filter((path) => path.startsWith(SKINS) && isPackageJson(path)).map((path) => path.slice(SKINS.length).split("/")[0]))].sort();
/** Every skin is @untzel/skin-<folder>, never "contract", with exactly the skin subpaths; the solution references them all. */
export function skinProblems(files, read) {
  const problems = [];
  const skins = skinsOf(files);
  for (const skin of skins) {
    const dir = `${SKINS}${skin}`;
    const json = JSON.parse(read(`${dir}/package.json`));
    if (skin === "contract") problems.push(`${dir}: no skin is called contract (the contract is @untzel/skin-contract)`);
    if (json.name !== `@untzel/skin-${skin}`) problems.push(`${dir}: the package is ${json.name}, not @untzel/skin-${skin}`);
    const expected = [".", "./pt-BR", "./styles.css", "./page.css", ...(files.some((path) => path.startsWith(`${dir}/src/testing/`)) ? ["./testing"] : [])].sort();
    const actual = Object.keys(json.exports ?? {}).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) problems.push(`${dir}: exports ${actual.join(", ")}, not exactly ${expected.join(", ")}`);
  }
  const solution = `${SKINS}tsconfig.json`;
  if (!files.includes(solution)) return [...problems, `${solution} is missing`];
  const tsconfig = JSON.parse(read(solution));
  if (tsconfig.compilerOptions?.composite !== true) problems.push(`${solution}: composite must be true (TS6306 for whoever references it)`);
  const references = new Set((tsconfig.references ?? []).map((reference) => posix.normalize(reference.path)));
  for (const skin of skins) for (const path of [skin, `${skin}/tsconfig.test.json`]) if (!references.has(path)) problems.push(`${solution}: does not reference ./${path}`);
  return problems;
}
/** The skin the alias line of apps/web/package.json names, or a problem. */
export function aliasOf(files, read) {
  const json = JSON.parse(read("apps/web/package.json"));
  const skins = skinsOf(files);
  const problems = [];
  const declared = { ...json.dependencies, ...json.devDependencies };
  const alias = declared["@untzel/skin"];
  const skin = SKIN_ALIAS.exec(alias ?? "")?.[1];
  if (skin === undefined) problems.push(`apps/web/package.json: "@untzel/skin" must be "workspace:@untzel/skin-<folder>@*", not ${JSON.stringify(alias)}`);
  else if (!skins.includes(skin)) problems.push(`apps/web/package.json: the alias names skin-${skin}, which has no folder in ${SKINS}`);
  for (const name of Object.keys(declared)) {
    const folder = /^@untzel\/skin-(.+)$/.exec(name)?.[1];
    if (folder !== undefined && skins.includes(folder)) problems.push(`apps/web/package.json: declares ${name}; the composition reaches the skin only through @untzel/skin`);
  }
  return { skin: skins.includes(skin) ? skin : undefined, problems };
}
const SPECIFIER = /(?:\bfrom|\bimport)\s*\(?\s*["']([^"']+)["']/g;
const NAMED = /^(?:import|export)(?:\s+type)?\s*\{([^}]*)\}\s*from\s*["'](@untzel\/skin(?:\/[^"']*)?)["']/gm;
const SIDE_EFFECT = /^import\s*["'](@untzel\/skin(?:\/[^"']*)?)["']/gm;
/** apps/web/src names no skin package, and takes from @untzel/skin only what the contract lists. */
export function compositionProblems(files, read, wordsMoved = false) {
  const problems = [];
  const skins = skinsOf(files);
  const allowed = (specifier) => [...(COMPOSITION_IMPORTS[specifier] ?? []), ...(wordsMoved || specifier !== "@untzel/skin" ? [] : COMPOSITION_WORDS_FROM_SKIN)];
  for (const file of files.filter((path) => path.startsWith("apps/web/src/") && /\.(ts|mjs)$/.test(path))) {
    const text = read(file);
    for (const [, specifier] of text.matchAll(SPECIFIER)) {
      const folder = /^@untzel\/skin-([^/]+)/.exec(specifier)?.[1];
      if (folder !== undefined && skins.includes(folder)) problems.push(`${file}: imports ${specifier}; use @untzel/skin`);
    }
    const explained = new Set();
    for (const match of text.matchAll(NAMED)) {
      explained.add(match.index);
      for (const name of match[1].split(",").map((part) => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]).filter((part) => part !== "")) {
        if (!allowed(match[2]).includes(name)) problems.push(`${file}: imports ${name} from ${match[2]}, outside the skin contract`);
      }
    }
    for (const match of text.matchAll(SIDE_EFFECT)) {
      explained.add(match.index);
      if (!STYLE_SHEETS.includes(match[1])) problems.push(`${file}: imports ${match[1]} for its side effect; only the two style sheets are`);
    }
    for (const match of text.matchAll(/^(?:import|export)\b[^;]*?["'](@untzel\/skin(?:\/[^"']*)?)["']/gm)) {
      if (!explained.has(match.index)) problems.push(`${file}: reads ${match[1]} in a form the layout check cannot list (default, namespace or dynamic)`);
    }
    for (const match of text.matchAll(/\bimport\s*\(\s*["'](@untzel\/skin(?:\/[^"']*)?)["']/g)) problems.push(`${file}: loads ${match[1]} with import(); load a module of the composition that re-exports it`);
    for (const sheet of STYLE_SHEETS) if (new RegExp(`from\\s*["']${sheet}["']`).test(text)) problems.push(`${file}: ${sheet} is a side-effect import only`);
  }
  return problems;
}
/** The skin of the alias has its suite, the files the config names, and its preview states. */
export function suiteProblems(files, skin) {
  if (skin === undefined) return [];
  const problems = [];
  const suite = `apps/web/tests/skins/${skin}/`;
  if (!files.some((path) => path.startsWith(suite))) problems.push(`${suite} is missing: the skin the alias names has no browser suite`);
  else for (const file of SUITE_FILES) if (!files.includes(`${suite}${file}`)) problems.push(`${suite}${file} is missing: the Playwright config or --measure names it`);
  if (!files.some((path) => path.startsWith(`apps/ui-preview/src/skins/${skin}/`))) problems.push(`apps/ui-preview/src/skins/${skin}/ is missing: the skin the alias names has no preview states`);
  return problems;
}
/** The instrument index and the sample packs are what instruments/ gives. */
export function generatedProblems(stale) {
  return stale.map((file) => `${file.path} is stale against instruments/: run pnpm generate (node tools/harness/generate-instruments.mjs)`);
}
/** Every condition, over a file list and a reader. */
export function layoutProblems(files, read, exists) {
  const alias = aliasOf(files, read);
  return [...folderProblems(files), ...packageProblems(files, read, exists), ...skinProblems(files, read), ...alias.problems, ...compositionProblems(files, read), ...suiteProblems(files, alias.skin)];
}
function main() {
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter((path) => path !== "" && existsSync(`${REPO}${path}`));
  const read = (path) => (existsSync(`${REPO}${path}`) ? readFileSync(`${REPO}${path}`, "utf8") : null);
  const problems = [...layoutProblems(files, read, (path) => existsSync(`${REPO}${path}`)), ...generatedProblems(staleFiles(generatedFiles(REPO), read))];
  for (const problem of problems) console.error(`layout  ${problem}`);
  console.log(problems.length === 0 ? "check:layout PASS: folders, packages, skins and the composition's alias follow the layout rules." : `check:layout FAIL: ${problems.length} problems`);
  process.exit(problems.length === 0 ? 0 : 1);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
