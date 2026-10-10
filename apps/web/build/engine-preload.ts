// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The built index.html starts the engine's largest pieces at parse time, at low priority,
// so the first screen keeps the network first: the DSP and the worklet script as fetch
// preloads (preloadAudio fetches
// both, same mode and credentials) and the boot chunk. The boot chunk's imports load with
// import("./boot"): preloading them too, or the parser chunk alone, held the first screen
// back by ~0.5 s under Slow 4G on HTTP/1.1 (measured), as their long downloads kept the
// sockets the first screen's template chunks wait for.
import type { HtmlTagDescriptor, Plugin } from "vite";

/** What this reads of a Rolldown output file: chunks and assets alike. */
export interface BundleFile {
  readonly type: "chunk" | "asset";
  readonly fileName: string;
  readonly isDynamicEntry?: boolean;
  readonly facadeModuleId?: string | null;
}
export type Bundle = Readonly<Record<string, BundleFile>>;

const DSP = /^assets\/untzel_dsp-[\w-]+\.wasm$/;
const WORKLET = /^assets\/processor-[\w-]+\.js$/;
const BOOT_SOURCE = "/apps/web/src/boot.ts";

/** Exactly one file matches: a renamed file fails the build instead of preloading nothing. */
function single(files: readonly BundleFile[], what: string, matches: (file: BundleFile) => boolean): BundleFile {
  const found = files.filter(matches);
  if (found.length !== 1) throw new Error(`engine preload: expected one ${what}, found ${found.length}`);
  return found[0] as BundleFile;
}

function link(rel: string, fileName: string, extra: Record<string, string> = {}): HtmlTagDescriptor {
  return { tag: "link", attrs: { rel, href: `./${fileName}`, ...extra, crossorigin: true, fetchpriority: "low" }, injectTo: "head" };
}

export function enginePreloadTags(bundle: Bundle): HtmlTagDescriptor[] {
  const files = Object.values(bundle);
  const dsp = single(files, "DSP WASM", (file) => file.type === "asset" && DSP.test(file.fileName));
  const worklet = single(files, "worklet script", (file) => file.type === "asset" && WORKLET.test(file.fileName));
  const boot = single(files, "boot chunk", (file) => file.type === "chunk" && file.isDynamicEntry === true && (file.facadeModuleId ?? "").endsWith(BOOT_SOURCE));
  return [
    link("preload", dsp.fileName, { as: "fetch", type: "application/wasm" }),
    link("preload", worklet.fileName, { as: "fetch" }),
    link("modulepreload", boot.fileName),
  ];
}

export function enginePreload(): Plugin {
  return {
    name: "untzel-engine-preload",
    transformIndexHtml: {
      order: "post",
      // The dev server has no bundle: nothing to preload.
      handler: (html, context) => (context.bundle === undefined ? html : { html, tags: enginePreloadTags(context.bundle) }),
    },
  };
}
