// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ExportFormat } from "@untzel/presentation/view-model";
import type { ExportPlan } from "@untzel/export";
import { describe, expect, it } from "vitest";
import { KeptExports, type KeptFile, type ObjectUrls } from "./kept-exports";

function kept(key: string, format: ExportFormat, bytes: number): KeptFile {
  return {
    key,
    format,
    plan: {} as ExportPlan,
    file: new File([new Uint8Array(bytes)], `${key}.bin`),
    details: { codecs: "", renderMs: 0, codecRetryMs: 0, audioSamples: 0, counters: { lateDrops: 0, queueDrops: 0, nanResets: 0 }, rateControl: null },
    label: "",
    canShare: false,
  };
}

function urls() {
  const live = new Set<string>();
  const fake: ObjectUrls = {
    create: (file) => {
      const url = `blob:${file.name}`;
      live.add(url);
      return url;
    },
    revoke: (url) => void live.delete(url),
  };
  return { fake, live };
}

describe("KeptExports", () => {
  it("keeps the last result of each format", () => {
    const results = new KeptExports(100, urls().fake);
    results.keep(kept("a", "story", 10));
    results.keep(kept("b", "story", 10));
    results.keep(kept("c", "audio", 10));
    expect(results.has("a")).toBe(false);
    expect(results.find("b")?.format).toBe("story");
    expect(results.has("c")).toBe(true);
  });

  it("drops the oldest above the ceiling, but never the newest", () => {
    const results = new KeptExports(100, urls().fake);
    results.keep(kept("story", "story", 40));
    results.keep(kept("audio", "audio", 40));
    results.keep(kept("video", "video", 40));
    expect([results.has("story"), results.has("audio"), results.has("video")]).toEqual([false, true, true]);
    results.keep(kept("long", "video", 150));
    expect([results.has("audio"), results.has("long")]).toEqual([false, true]);
  });

  it("gives each kept file a preview URL and revokes it when the file leaves", () => {
    const { fake, live } = urls();
    const results = new KeptExports(100, fake);
    results.keep(kept("a", "story", 10));
    expect(results.find("a")?.url).toBe("blob:a.bin");
    results.keep(kept("b", "story", 10));
    expect([...live]).toEqual(["blob:b.bin"]);
    results.clear();
    expect(live.size).toBe(0);
    expect(results.find("b")).toBeNull();
  });
});
