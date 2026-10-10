// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { enginePreloadTags, type Bundle, type BundleFile } from "./engine-preload";

const chunk = (fileName: string, extra: Partial<BundleFile> = {}): BundleFile => ({ type: "chunk", fileName, ...extra });
const asset = (fileName: string): BundleFile => ({ type: "asset", fileName });
const bundleOf = (...files: BundleFile[]): Bundle => Object.fromEntries(files.map((file) => [file.fileName, file]));
const BASE = [
  chunk("assets/index-a.js", { facadeModuleId: "/r/apps/web/index.html" }),
  chunk("assets/boot-d.js", { isDynamicEntry: true, facadeModuleId: "/r/apps/web/src/boot.ts" }),
  chunk("assets/language-e.js"),
  chunk("assets/editor-g.js", { isDynamicEntry: true, facadeModuleId: "/r/apps/web/src/engine/editor-mount.ts" }),
  asset("assets/untzel_dsp-H1.wasm"),
  asset("assets/processor-I2.js"),
  asset("assets/transport.worker-J3.js"),
];
const hrefs = (bundle: Bundle) => enginePreloadTags(bundle).map((tag) => `${String(tag.attrs?.["rel"])} ${String(tag.attrs?.["href"])}`);
const without = (part: string) => BASE.filter((file) => !file.fileName.includes(part));

describe("enginePreloadTags", () => {
  it("preloads the DSP, the worklet script and the boot chunk, nothing else", () => {
    expect(hrefs(bundleOf(...BASE))).toEqual([
      "preload ./assets/untzel_dsp-H1.wasm",
      "preload ./assets/processor-I2.js",
      "modulepreload ./assets/boot-d.js",
    ]);
  });
  it("marks every link low priority and cross-origin, the WASM as a fetch of application/wasm", () => {
    const tags = enginePreloadTags(bundleOf(...BASE));
    for (const tag of tags) expect(tag).toMatchObject({ tag: "link", injectTo: "head", attrs: { crossorigin: true, fetchpriority: "low" } });
    expect(tags[0]?.attrs).toMatchObject({ as: "fetch", type: "application/wasm" });
    expect(tags[1]?.attrs).toMatchObject({ as: "fetch" });
  });
  it("fails the build when the DSP is missing", () => {
    expect(() => enginePreloadTags(bundleOf(...without(".wasm")))).toThrow(/one DSP WASM, found 0/);
  });
  it("fails the build when a pattern matches twice", () => {
    expect(() => enginePreloadTags(bundleOf(...BASE, asset("assets/processor-K4.js")))).toThrow(/one worklet script, found 2/);
  });
  it("fails the build without the boot chunk", () => {
    expect(() => enginePreloadTags(bundleOf(...without("boot")))).toThrow(/one boot chunk, found 0/);
  });
});
