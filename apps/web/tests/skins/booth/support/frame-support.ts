// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The page's own frames while the music plays: how many animation frames
// ran, how far apart, how many DOM write batches landed outside the light stage, and the
// long animation frames with the scripts that made them long.
import type { Page } from "@playwright/test";

export interface LongFrameScript {
  readonly invoker: string;
  readonly sourceURL: string;
  readonly durationMs: number;
}
export interface PageFrames {
  readonly seconds: number;
  readonly frames: number;
  readonly fps: number;
  readonly p95IntervalMs: number;
  /** MutationObserver deliveries with a record outside `.ui-stage`: one per view update. */
  readonly batches: number;
  readonly batchesPerFrame: number;
  /** Frames that took two or more of those batches: a view drawn twice before one paint. */
  readonly framesWithSeveralBatches: number;
  readonly longFrames: { readonly count: number; readonly totalMs: number; readonly topScripts: readonly LongFrameScript[] };
}

// Over 40 lines: test support; the measurement runs inside the page as one evaluate, which cannot call module functions.
export function measurePageFrames(page: Page, seconds: number): Promise<PageFrames> {
  return page.evaluate(
    (span) =>
      new Promise<PageFrames>((resolve) => {
        const intervals: number[] = [];
        const scripts: LongFrameScript[] = [];
        let longCount = 0;
        let longMs = 0;
        let batches = 0;
        let frame = 0;
        const perFrame = new Map<number, number>();
        const stage = document.querySelector(".ui-stage");
        const outsideStage = (node: Node): boolean => stage === null || !stage.contains(node);
        const mutations = new MutationObserver((records) => {
          if (!records.some((record) => outsideStage(record.target))) return;
          batches += 1;
          perFrame.set(frame, (perFrame.get(frame) ?? 0) + 1);
        });
        mutations.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
        const long = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            longCount += 1;
            longMs += entry.duration;
            const frame = entry as PerformanceEntry & { scripts?: { invoker: string; sourceURL: string; duration: number }[] };
            for (const script of frame.scripts ?? []) scripts.push({ invoker: script.invoker, sourceURL: script.sourceURL.split("/").pop() ?? "", durationMs: Math.round(script.duration) });
          }
        });
        long.observe({ type: "long-animation-frame", buffered: false });
        let start: number | null = null;
        let last = 0;
        const tick = (now: number): void => {
          if (start === null) start = now;
          else intervals.push(now - last);
          last = now;
          frame += 1;
          if (now - start < span * 1000) {
            requestAnimationFrame(tick);
            return;
          }
          mutations.disconnect();
          long.disconnect();
          const elapsed = (now - start) / 1000;
          const sorted = [...intervals].sort((a, b) => a - b);
          const frames = intervals.length;
          resolve({
            seconds: Math.round(elapsed * 100) / 100,
            frames,
            fps: Math.round((frames / elapsed) * 10) / 10,
            p95IntervalMs: Math.round((sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? Number.NaN) * 10) / 10,
            batches,
            batchesPerFrame: Math.round((batches / Math.max(1, frames)) * 100) / 100,
            framesWithSeveralBatches: [...perFrame.values()].filter((count) => count > 1).length,
            longFrames: {
              count: longCount,
              totalMs: Math.round(longMs),
              topScripts: scripts.sort((a, b) => b.durationMs - a.durationMs).slice(0, 5),
            },
          });
        };
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}
