// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Shared by the measurement tests that need a real Chrome (first-sound, scale, drift,
// swap-under-load). Opt-in: they run with `pnpm test:browser --measure` and write
// .cache/measurements/<name>.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type CDPSession, type Page } from "@playwright/test";

export const MEASURING = process.env["UNTZEL_MEASURE"] === "1";
const OUT = join(process.env["UNTZEL_SCREENSHOTS"] ?? join(process.cwd(), "../../.cache/screenshots"), "../measurements");
/** Tempo of tools/sim/fixtures/phase1-onboard.untzel, which the measurements load. */
export const ONBOARD_BPM = 132;

/**
 * Every measurement file skips outside --measure; the harness runs one test at a time.
 * Serial (the default) shares one worker for a file's results; `independent` tests each
 * write their own file, and a failed one does not skip the next.
 */
export function measurementSuite(mode: "serial" | "independent" = "serial"): void {
  test.skip(!MEASURING, "measurements run with pnpm test:browser --measure");
  if (mode === "serial") test.describe.configure({ mode: "serial" });
}

export interface InstanceReading {
  readonly name: string;
  readonly onsetCount: number;
  readonly lastOnsetFrame: number;
  readonly activeVoices: number;
}

export interface StatsReading {
  readonly frame: number;
  readonly lateDrops: number;
  readonly queueDrops: number;
  readonly nanResets: number;
  readonly unknownTargets: number;
  readonly unknownMessages: number;
  readonly skippedBars: number;
  readonly resyncs: number;
  readonly instances: readonly InstanceReading[];
}

export interface Reading {
  readonly stats: StatsReading | null;
  readonly startFrame: number | null;
  readonly sampleRate: number;
  readonly meter: number | null;
  readonly calibrated: boolean;
  readonly underruns: number | null;
  readonly tappedAt: number | null;
  readonly runningAt: number | null;
  readonly outputLatency: number;
  readonly bar: number | null;
}

interface Hooks {
  stats(): StatsReading | null;
  startFrame(): number | null;
  sampleRate(): number;
  meter(): number | null;
  calibrated(): boolean;
  underruns(): number | null;
  tappedAt(): number | null;
  runningAt(): number | null;
  outputLatency(): number;
  session(): { position: { bar: number } | null };
}

export async function read(page: Page): Promise<Reading> {
  return page.evaluate(() => {
    const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
    return {
      stats: t.stats(),
      startFrame: t.startFrame(),
      sampleRate: t.sampleRate(),
      meter: t.meter(),
      calibrated: t.calibrated(),
      underruns: t.underruns(),
      tappedAt: t.tappedAt(),
      runningAt: t.runningAt(),
      outputLatency: t.outputLatency(),
      bar: t.session().position?.bar ?? null,
    };
  });
}

/** `immediately`: click as soon as the button exists, without waiting for it to settle (first sound). */
export async function tapAndWait(page: Page, immediately = false): Promise<void> {
  const button = page.getByRole("button", { name: "Tap to play" });
  if (immediately) {
    await button.waitFor({ state: "attached" });
    await button.click({ force: true });
  } else {
    await button.click();
  }
  await page.waitForFunction(() => {
    const t = (globalThis as unknown as { untzelTest?: Hooks }).untzelTest;
    return t !== undefined && t.startFrame() !== null && t.stats() !== null;
  }, undefined, { timeout: 30_000 });
}

/** Every counter of the worklet, the worker and the transport; the timing tests need all of them at zero. */
export function counters(stats: StatsReading | null): Record<string, number> | null {
  if (stats === null) return null;
  const { lateDrops, queueDrops, nanResets, unknownTargets, unknownMessages, skippedBars, resyncs } = stats;
  return { lateDrops, queueDrops, nanResets, unknownTargets, unknownMessages, skippedBars, resyncs };
}

/** startFrame + floor(n × 60 × sr / bpm), exact in integers. */
export function beatFrame(startFrame: number, beat: number, sampleRate: number, bpm = ONBOARD_BPM): number {
  return startFrame + Number((BigInt(beat) * 60n * BigInt(sampleRate)) / BigInt(bpm));
}

/** The kick's last onset minus where `onsetCount − 1` beats from the start put it; null before it sounds. */
export function kickDrift(reading: Reading, track = "kick"): number | null {
  const kick = reading.stats?.instances.find((instance) => instance.name === track);
  if (kick === undefined || reading.startFrame === null || kick.onsetCount < 1) return null;
  return kick.lastOnsetFrame - beatFrame(reading.startFrame, kick.onsetCount - 1, reading.sampleRate);
}

/** CDP WebAudio: renderCapacity of the realtime context. */
export async function webAudio(page: Page): Promise<{ cdp: CDPSession; renderCapacity: () => Promise<number | null> }> {
  const cdp = await page.context().newCDPSession(page);
  let id: string | null = null;
  cdp.on("WebAudio.contextCreated", (event: { context: { contextId: string; contextType: string } }) => {
    if (event.context.contextType === "realtime") id = event.context.contextId;
  });
  await cdp.send("WebAudio.enable");
  return {
    cdp,
    renderCapacity: async () => {
      if (id === null) return null;
      const data = (await cdp.send("WebAudio.getRealtimeData", { contextId: id })) as { realtimeData: { renderCapacity: number } };
      return data.realtimeData.renderCapacity;
    },
  };
}

/** CPU ×4 and Slow 4G as in Lighthouse: 150 ms RTT, 1.6 Mbit/s down, 750 kbit/s up. */
export async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
}

export function writeMeasurement(name: string, results: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(results, null, 2)}\n`);
}
