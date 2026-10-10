// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { SUITE_FILES, aliasOf, compositionProblems, folderProblems, generatedProblems, layoutProblems, packageProblems, skinProblems, suiteProblems } from "./check-layout.mjs";
const json = (value) => JSON.stringify(value);
// Built so that no specifier search of the repository reads these fixtures as imports.
const SKIN = ["@untzel", "skin"].join("/");
const skinPackage = (name, extra = {}) => json({ name, exports: { ".": "./src/index.ts", "./pt-BR": "./src/copy/portuguese.ts", "./styles.css": "./src/styles/skin.css", "./page.css": "./src/styles/page.css", ...extra } });
/** A tree that passes every condition, with one skin called lamp. */
const passing = () => ({
  "packages/core/package.json": json({ name: "@x/core", exports: { ".": "./src/index.ts" } }),
  "packages/core/src/index.ts": "",
  "packages/skins/tsconfig.json": json({ compilerOptions: { composite: true }, references: [{ path: "./lamp" }, { path: "./lamp/tsconfig.test.json" }] }),
  "packages/skins/lamp/package.json": skinPackage("@untzel/skin-lamp"),
  "packages/skins/lamp/src/index.ts": "",
  "packages/skins/lamp/src/copy/portuguese.ts": "",
  "packages/skins/lamp/src/styles/skin.css": "",
  "packages/skins/lamp/src/styles/page.css": "",
  "apps/web/package.json": json({ name: "@x/web", dependencies: { "@untzel/skin": "workspace:@untzel/skin-lamp@*" } }),
  "apps/web/src/main.ts": 'import "' + SKIN + '/styles.css";\nimport "' + SKIN + '/page.css";\nimport { createShell } from "' + SKIN + '";\nimport type { SkinOptions } from "@untzel/skin-contract";\n',
  "apps/web/src/strings/portuguese.ts": 'export { controlsPortuguese } from "' + SKIN + '/pt-BR";\n',
  "apps/ui-preview/src/skins/lamp/screens.ts": "",
  ...Object.fromEntries(SUITE_FILES.map((file) => [`apps/web/tests/skins/lamp/${file}`, ""])),
});
const check = (tree) => layoutProblems(Object.keys(tree), (path) => tree[path], () => false);
describe("check-layout", () => {
  it("passes a tree that follows every rule", () => {
    expect(check(passing())).toEqual([]);
  });
  it("fails a folder above 15 production modules or 15 browser tests, and counts no test, declaration or generated file", () => {
    const modules = Array.from({ length: 16 }, (_, index) => `packages/core/src/m${index}.ts`);
    expect(folderProblems(modules)).toEqual(["packages/core/src has 16 production modules (ceiling 15): split it by subdomain"]);
    expect(folderProblems([...modules.slice(0, 15), "packages/core/src/a.test.ts", "packages/core/src/b.d.ts", "packages/core/src/generated/c.ts"])).toEqual([]);
    const tests = Array.from({ length: 16 }, (_, index) => `apps/web/tests/skins/lamp/solo/t${index}.browser.ts`);
    expect(folderProblems(tests)).toEqual(["apps/web/tests/skins/lamp/solo has 16 browser tests (ceiling 15)"]);
  });
  it("fails a package without exports, a target that does not exist and src/testing/ without ./testing", () => {
    const tree = {
      "packages/a/package.json": json({ name: "@x/a" }),
      "packages/b/package.json": json({ name: "@x/b", exports: { ".": "./src/index.ts" } }),
      "packages/c/package.json": json({ name: "@x/c", exports: { ".": "./src/index.ts" } }),
      "packages/c/src/index.ts": "",
      "packages/c/src/testing/fixture.ts": "",
    };
    expect(packageProblems(Object.keys(tree), (path) => tree[path])).toEqual([
      "packages/a: package.json has no exports",
      "packages/b: . points to packages/b/src/index.ts, which does not exist",
      "packages/c: has src/testing/ but no ./testing export",
    ]);
  });
  it("accepts a target that is a build output on disk", () => {
    const tree = { "packages/dsp/package.json": json({ name: "@x/dsp", exports: { "./x.wasm": "./dist/x.wasm" } }) };
    expect(packageProblems(Object.keys(tree), (path) => tree[path], (path) => path === "packages/dsp/dist/x.wasm")).toEqual([]);
  });
  it("fails a package named @untzel/skin", () => {
    const tree = { ...passing(), "tools/x/package.json": json({ name: "@untzel/skin" }) };
    expect(check(tree)).toEqual(["tools/x/package.json: the name @untzel/skin is the composition's alias, never a package"]);
  });
  it("fails a skin with another name, called contract, or with other subpaths, and asks ./testing with src/testing/", () => {
    const tree = { ...passing(), "packages/skins/lamp/package.json": json({ name: "@untzel/lamp", exports: { ".": "./src/index.ts" } }), "packages/skins/lamp/src/testing/a.ts": "" };
    const problems = skinProblems(Object.keys(tree), (path) => tree[path]);
    expect(problems).toContain("packages/skins/lamp: the package is @untzel/lamp, not @untzel/skin-lamp");
    expect(problems).toContain("packages/skins/lamp: exports ., not exactly ., ./page.css, ./pt-BR, ./styles.css, ./testing");
    const contract = { ...passing(), "packages/skins/contract/package.json": skinPackage("@untzel/skin-contract") };
    expect(skinProblems(Object.keys(contract), (path) => contract[path])).toContain("packages/skins/contract: no skin is called contract (the contract is @untzel/skin-contract)");
  });
  it("fails a solution without composite or without a skin and its test project", () => {
    const tree = { ...passing(), "packages/skins/tsconfig.json": json({ references: [{ path: "./lamp" }] }) };
    expect(skinProblems(Object.keys(tree), (path) => tree[path])).toEqual([
      "packages/skins/tsconfig.json: composite must be true (TS6306 for whoever references it)",
      "packages/skins/tsconfig.json: does not reference ./lamp/tsconfig.test.json",
    ]);
  });
  it("fails an alias of another form, of a folder that does not exist, and a declared skin package", () => {
    const read = (dependencies) => (path) => (path === "apps/web/package.json" ? json({ dependencies }) : passing()[path]);
    const files = Object.keys(passing());
    expect(aliasOf(files, read({ "@untzel/skin": "workspace:*" })).problems[0]).toContain('must be "workspace:@untzel/skin-<folder>@*"');
    expect(aliasOf(files, read({ "@untzel/skin": "workspace:@untzel/skin-dusk@*" })).problems).toEqual(["apps/web/package.json: the alias names skin-dusk, which has no folder in packages/skins/"]);
    expect(aliasOf(files, read({ "@untzel/skin": "workspace:@untzel/skin-lamp@*", "@untzel/skin-lamp": "workspace:*" })).problems).toEqual([
      "apps/web/package.json: declares @untzel/skin-lamp; the composition reaches the skin only through @untzel/skin",
    ]);
    expect(aliasOf(files, read({ "@untzel/skin": "workspace:@untzel/skin-lamp@*", "@untzel/skin-contract": "workspace:*" })).problems).toEqual([]);
  });
  it("fails a composition import of a skin package or of a name outside the contract", () => {
    const tree = {
      ...passing(),
      "apps/web/src/a.ts": 'import { createShell } from "' + SKIN + '-lamp";\n',
      "apps/web/src/b.ts": 'import { createShell, secretHelper } from "' + SKIN + '";\n',
      "apps/web/src/c.ts": 'import * as skin from "' + SKIN + '";\n',
      "apps/web/src/d.ts": 'import sheet from "' + SKIN + '/styles.css";\n',
      "apps/web/src/e.ts": 'const pt = import("' + SKIN + '/pt-BR");\n',
    };
    expect(compositionProblems(Object.keys(tree), (path) => tree[path], true)).toEqual([
      "apps/web/src/a.ts: imports @untzel/skin-lamp; use @untzel/skin",
      "apps/web/src/b.ts: imports secretHelper from @untzel/skin, outside the skin contract",
      "apps/web/src/c.ts: reads @untzel/skin in a form the layout check cannot list (default, namespace or dynamic)",
      "apps/web/src/d.ts: reads @untzel/skin/styles.css in a form the layout check cannot list (default, namespace or dynamic)",
      "apps/web/src/d.ts: @untzel/skin/styles.css is a side-effect import only",
      "apps/web/src/e.ts: loads @untzel/skin/pt-BR with import(); load a module of the composition that re-exports it",
    ]);
  });
  it("accepts the words the composition reads from the skin", () => {
    const tree = { ...passing(), "apps/web/src/a.ts": 'import { liveStrings as strings, remixTitle } from "' + SKIN + '";\n' };
    expect(compositionProblems(Object.keys(tree), (path) => tree[path])).toEqual([]);
    expect(compositionProblems(Object.keys(tree), (path) => tree[path], true)).toHaveLength(2);
  });
  it("fails the skin of the alias without its suite, a file the config names, or its preview states", () => {
    expect(suiteProblems(["apps/ui-preview/src/skins/lamp/screens.ts"], "lamp")).toEqual(["apps/web/tests/skins/lamp/ is missing: the skin the alias names has no browser suite"]);
    const files = Object.keys(passing()).filter((path) => !path.endsWith("static-csp.browser.ts") && !path.startsWith("apps/ui-preview/"));
    expect(suiteProblems(files, "lamp")).toEqual([
      "apps/web/tests/skins/lamp/parallel/page/static-csp.browser.ts is missing: the Playwright config or --measure names it",
      "apps/ui-preview/src/skins/lamp/ is missing: the skin the alias names has no preview states",
    ]);
  });
  it("fails a generated instrument index that is stale against instruments/", () => {
    expect(generatedProblems([])).toEqual([]);
    expect(generatedProblems([{ path: "packages/instrument-index/src/generated/manifests.ts" }])).toEqual([
      "packages/instrument-index/src/generated/manifests.ts is stale against instruments/: run pnpm generate (node tools/harness/generate-instruments.mjs)",
    ]);
  });
});
