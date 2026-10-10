// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The real session in the browser tests: start it, read its text, and sample the
// AnalyserNode RMS to prove the music never stops while the person edits.

import { availableParallelism, loadavg } from "node:os";
import { expect, test, type Page } from "@playwright/test";

interface Hooks {
  contextState(): string;
  rms(): number;
  underruns(): number | null;
  stats(): { readonly lateDrops: number; readonly resyncs: number } | null;
  session(): { readonly source: string };
}

export const RMS_THRESHOLD = 0.005;
const RMS_SLICE_MS = 500;

/**
 * Taps to play and waits for the running audio context. These tests read the phase 1
 * onboard (132 BPM, a 4-bar loop, kick/hat/ride/sub/bass), kept as a fixture for the
 * tests whose numbers are about it.
 */
export async function startSession(page: Page): Promise<void> {
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
}

export function sourceOf(page: Page): Promise<string> {
  return page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session().source);
}

/** The line that starts with `prefix`, for example "kick:" or "song ". */
export async function lineOf(page: Page, prefix: string): Promise<string> {
  return (await sourceOf(page)).split("\n").find((line) => line.startsWith(prefix)) ?? "";
}

/** Waits until the transport's "bar N of M" names another bar: one bar boundary. */
export async function waitForNextBar(page: Page): Promise<void> {
  const position = page.locator(".ui-transport__position");
  const bar = async (): Promise<string> => /bar \d+/.exec((await position.textContent()) ?? "")?.[0] ?? "";
  const now = await bar();
  expect(now, "the transport names the bar playing").not.toBe("");
  await expect.poll(bar, { timeout: 4_000 }).not.toBe(now);
}
/** The bars of a track's pattern as written, split on "/". */
export async function barsOf(page: Page, track: string): Promise<string[]> {
  const line = await lineOf(page, `${track}:`);
  return line.replace(/^\S+:\s+\S+\s+/, "").replace(/\s*\|.*$/, "").split(/\s*\/\s*/);
}

/**
 * Samples the AnalyserNode every 25 ms in the page until stopRms() collects it, with the
 * context state and Chrome's cumulative `playbackStats.underrunEvents` (null when the
 * browser does not report it).
 */
export async function startRms(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
    const samples: { at: number; rms: number; state: string; underruns: number | null; lateDrops: number | null; resyncs: number | null }[] = [];
    const timer = window.setInterval(
      () => samples.push({ at: performance.now(), rms: t.rms(), state: t.contextState(), underruns: t.underruns(), lateDrops: t.stats()?.lateDrops ?? null, resyncs: t.stats()?.resyncs ?? null }),
      25,
    );
    (globalThis as unknown as Record<string, unknown>)["untzelRms"] = { samples, timer };
  });
}

export interface RmsRecord {
  /** The loudest RMS of the quietest whole 500 ms slice. */
  readonly quietestSlice: number;
  readonly slices: number;
  /** Every audio context state seen while sampling. */
  readonly states: readonly string[];
  /** Underrun events during the quietest slice; null when the browser does not count. */
  readonly quietSliceUnderruns: number | null;
  /** Events the DSP dropped as late (they reached it after their frame) up to the quietest slice's end: diagnosis only. */
  readonly lateDropsAtQuietSlice: number | null;
  /** Readings in the quietest slice (20 at 25 ms) and the longest gap between two of them, ms: diagnosis only. */
  readonly quietSliceReadings: number;
  /** The transport's resyncs (a late tick skips to the next bar) up to the quietest slice's end: diagnosis only. */
  readonly resyncsAtQuietSlice: number | null;
  readonly quietSliceLongestGapMs: number;
}

/** The fewest whole slices a measurement may have: a short test once measured none. */
const MINIMUM_SLICES = 2;
/**
 * The quietest whole 500 ms slice since startRms, how many there were, and its underruns.
 * Keeps sampling until at least `minimumSlices` whole slices exist (two by default), so a
 * test that ends in under a second still measures sound instead of nothing,
 * and a test that asks for more slices is not failed by a fast machine.
 */
// Over 40 lines: test support; the wait and the slices run inside the page, which cannot call module functions.
export async function stopRms(page: Page, minimumSlices = MINIMUM_SLICES): Promise<RmsRecord> {
  await page.waitForFunction(
    (spanMs) => {
      const samples = (globalThis as unknown as { untzelRms: { samples: { at: number }[] } }).untzelRms.samples;
      const first = samples[0]?.at;
      const last = samples.at(-1)?.at;
      return first !== undefined && last !== undefined && last - first >= spanMs;
    },
    Math.max(MINIMUM_SLICES, minimumSlices) * RMS_SLICE_MS,
    { polling: 50 },
  );
  // Over 40 lines: runs inside the page, so the slices are read here, in one pass.
  return page.evaluate((sliceMs) => {
    type Sample = { at: number; rms: number; state: string; underruns: number | null; lateDrops: number | null; resyncs: number | null };
    const record = (globalThis as unknown as { untzelRms: { samples: Sample[]; timer: number } }).untzelRms;
    window.clearInterval(record.timer);
    const first = record.samples[0]?.at ?? 0;
    const last = record.samples.at(-1)?.at ?? 0;
    type Slice = { loudest: number; underrunsAtEnd: number | null; lateDropsAtEnd: number | null; resyncsAtEnd: number | null; readings: number; lastAt: number; longestGapMs: number };
    const slices = new Map<number, Slice>();
    let previousAt = first;
    for (const sample of record.samples) {
      const slice = Math.floor((sample.at - first) / sliceMs);
      const entry = slices.get(slice);
      slices.set(slice, {
        loudest: Math.max(entry?.loudest ?? 0, sample.rms),
        underrunsAtEnd: sample.underruns,
        lateDropsAtEnd: sample.lateDrops,
        resyncsAtEnd: sample.resyncs,
        readings: (entry?.readings ?? 0) + 1,
        lastAt: sample.at,
        longestGapMs: Math.max(entry?.longestGapMs ?? 0, sample.at - previousAt),
      });
      previousAt = sample.at;
    }
    const whole = [...slices.entries()].filter(([slice]) => (slice + 1) * sliceMs <= last - first);
    const quietest = whole.reduce<[number, Slice] | null>(
      (low, entry) => (low === null || entry[1].loudest < low[1].loudest ? entry : low),
      null,
    );
    // Underruns counted from the end of the slice before (or the first sample) to its end.
    const before = quietest === null ? null : (slices.get(quietest[0] - 1)?.underrunsAtEnd ?? record.samples[0]?.underruns ?? null);
    const atEnd = quietest?.[1].underrunsAtEnd ?? null;
    return {
      quietestSlice: quietest?.[1].loudest ?? 0,
      slices: whole.length,
      states: [...new Set(record.samples.map((sample) => sample.state))],
      quietSliceUnderruns: before === null || atEnd === null ? null : atEnd - before,
      lateDropsAtQuietSlice: quietest?.[1].lateDropsAtEnd ?? null,
      quietSliceReadings: quietest?.[1].readings ?? 0,
      resyncsAtQuietSlice: quietest?.[1].resyncsAtEnd ?? null,
      quietSliceLongestGapMs: Math.round(quietest?.[1].longestGapMs ?? 0),
    };
  }, RMS_SLICE_MS);
}

/**
 * The music never stopped: every whole 500 ms slice has sound. A silent slice fails the
 * test, except when Chrome counted audio underruns in that very slice while this machine
 * was overloaded (1-minute load average above its core count): the audio thread was
 * starved by other work, which says nothing about Untzel. That case is skipped with an
 * "environmental" annotation, never passed; rerun it on a quiet machine.
 * A silence without underruns, or with the machine idle,
 * always fails.
 */
export function expectSoundThroughout(rms: RmsRecord, what: string): void {
  // No whole slice is no measurement, never a silence and never a pass.
  expect(rms.slices, `${what}: no whole 500 ms slice measured`).toBeGreaterThanOrEqual(MINIMUM_SLICES);
  const isSilent = rms.quietestSlice <= RMS_THRESHOLD;
  const load = loadavg()[0] ?? 0;
  const isOverloaded = load > availableParallelism();
  if (isSilent && (rms.quietSliceUnderruns ?? 0) > 0 && isOverloaded) {
    const description = `silent 500 ms slice (RMS ${rms.quietestSlice.toFixed(4)}) with ${rms.quietSliceUnderruns} underruns at load ${load.toFixed(1)} on ${availableParallelism()} cores`;
    test.info().annotations.push({ type: "environmental", description });
    test.skip(true, `environmental: ${description}`);
  }
  expect(rms.quietestSlice, `${what}: AnalyserNode RMS in every 500 ms (underruns in that slice: ${rms.quietSliceUnderruns ?? "not reported"}; late drops by its end: ${rms.lateDropsAtQuietSlice ?? "not reported"}; resyncs by its end: ${rms.resyncsAtQuietSlice ?? "not reported"}; ${rms.quietSliceReadings} readings, longest gap ${rms.quietSliceLongestGapMs} ms; context ${rms.states.join("/")})`).toBeGreaterThan(RMS_THRESHOLD);
}
