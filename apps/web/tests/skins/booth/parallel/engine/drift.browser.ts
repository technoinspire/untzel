// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The onboard plays 10 min without drift, in
// loop and as a song, for real in Chrome: stats read every 250 ms; halfway an invalid
// text, and two bars later the same text with "kick … | gain 0.9". On every read:
// all counters and playbackStats.underrunEvents at zero, and the kick's lastOnsetFrame
// exactly where its onsetCount puts it:
//   loop: startFrame + floor((onsetCount − 1) × 60 × sr / 132)
//   song (onboard with "| loop" on the song): the same grid, with the beats of break
//         (bars 28–35 of every 56-bar pass) skipped, counted from the song's own start.
// Results go to .cache/measurements/drift-<mode>.json.
// UNTZEL_DRIFT_SECONDS shortens the runs for a quick check (default 600).

import { expect, test, type Page } from "@playwright/test";
import {
  ONBOARD_BPM,
  beatFrame,
  counters,
  kickDrift,
  measurementSuite,
  read,
  tapAndWait,
  writeMeasurement,
  type Reading,
} from "../../support/measure-support";

// Each mode writes its own file: a failure in loop must not skip the song run.
measurementSuite("independent");

const SECONDS = Number(process.env["UNTZEL_DRIFT_SECONDS"] ?? 600);
const READ_EVERY_MS = 250;
const BAR_MS = (240 / ONBOARD_BPM) * 1000;
const PASS_BARS = 56;
const BREAK_BARS = [28, 36] as const;
const KICK_BARS_PER_PASS = PASS_BARS - (BREAK_BARS[1] - BREAK_BARS[0]);

interface TextHooks {
  applyText(text: string): void;
  stop(): void;
  play(mode: "loop" | "song"): unknown;
  session(): { source: string; valid: boolean; mode: string | null };
}

/** The song beat of the n-th kick (0-based) of the looped onboard song: break has none. */
function songKickBeat(n: number): number {
  const perPass = KICK_BARS_PER_PASS * 4;
  const pass = Math.floor(n / perPass);
  const inPass = n % perPass;
  const beforeBreak = BREAK_BARS[0] * 4;
  const beat = inPass < beforeBreak ? inPass : inPass + (BREAK_BARS[1] - BREAK_BARS[0]) * 4;
  return pass * PASS_BARS * 4 + beat;
}

/** Song mode: lastOnsetFrame minus the frame of kick number onsetCount − baseline − 1. */
function songKickDrift(reading: Reading, baseline: number): number | null {
  const kick = reading.stats?.instances.find((instance) => instance.name === "kick");
  if (kick === undefined || reading.startFrame === null) return null;
  const n = kick.onsetCount - baseline;
  if (n < 1) return null;
  return kick.lastOnsetFrame - beatFrame(reading.startFrame, songKickBeat(n - 1), reading.sampleRate);
}

// page.evaluate serializes its function, so each one reaches the hooks itself.
const sourceOf = (page: Page): Promise<string> => page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.session().source);

/** Stops the loop and plays the onboard as a looped song; returns the kick's onsets before it. */
async function startSong(page: Page): Promise<number> {
  const source = await sourceOf(page);
  const song = source.replace(/^(song .*)$/m, "$1 | loop");
  expect(song, "the onboard has a song line").not.toBe(source);
  await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.stop());
  await page.waitForTimeout(500);
  const baseline = (await read(page)).stats?.instances.find((instance) => instance.name === "kick")?.onsetCount ?? 0;
  await page.evaluate((text) => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.applyText(text), song);
  await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.play("song"));
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest: { startFrame(): number | null } }).untzelTest.startFrame() !== null);
  expect(await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.session().mode)).toBe("song");
  return baseline;
}

for (const mode of ["loop", "song"] as const) {
  test(`onboard plays ${SECONDS} s in ${mode} mode without drift, through an invalid edit and a gain edit`, async ({ page }) => {
    test.setTimeout((SECONDS + 90) * 1000);
    // The drift check stays on the first onboard, kept as a fixture.
    await page.goto("./?template=phase1-onboard");
    await tapAndWait(page);
    const baseline = mode === "song" ? await startSong(page) : 0;
    const drift = (reading: Reading): number | null => (mode === "song" ? songKickDrift(reading, baseline) : kickDrift(reading));
    const first = await read(page);
    const text = await sourceOf(page);
    expect(text).toContain("| drive 0.3");
    const startedAt = Date.now();
    const editAt = (SECONDS / 2) * 1000;
    let invalidAt: number | null = null;
    let gainAt: number | null = null;
    let reads = 0;
    let checkedReads = 0;
    let worstDrift = 0;
    const failures: string[] = [];
    let lastState = "";
    let last = first;
    while (Date.now() - startedAt < SECONDS * 1000) {
      await page.waitForTimeout(READ_EVERY_MS);
      const elapsed = Date.now() - startedAt;
      if (invalidAt === null && elapsed >= editAt) {
        invalidAt = elapsed;
        await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.applyText("kick: kik x..."));
        expect(await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.session().valid), "the invalid text is kept as text, not loaded").toBe(false);
      }
      if (invalidAt !== null && gainAt === null && elapsed >= invalidAt + 2 * BAR_MS) {
        gainAt = elapsed;
        await page.evaluate((edited) => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.applyText(edited), text.replace("| drive 0.3", "| drive 0.3 | gain 0.9"));
        expect(await page.evaluate(() => (globalThis as unknown as { untzelTest: TextHooks }).untzelTest.session().valid), "the gain edit is valid").toBe(true);
      }
      const reading = await read(page);
      last = reading;
      reads += 1;
      const offset = drift(reading);
      if (offset !== null) {
        checkedReads += 1;
        worstDrift = Math.max(worstDrift, Math.abs(offset));
        if (offset !== 0) failures.push(`${elapsed} ms: kick drift ${offset}`);
      }
      // The counters only grow: a failure is recorded when one changes, and the run goes on to the end.
      const values = counters(reading.stats);
      const nonZero =
        values === null ? ["no stats"] : Object.entries(values).filter(([, value]) => value !== 0).map(([key, value]) => `${key}=${value}`);
      const state = [...nonZero, ...((reading.underruns ?? 0) !== 0 ? [`underrunEvents=${reading.underruns}`] : [])].join(", ");
      if (state !== lastState && state !== "") failures.push(`${elapsed} ms: ${state}`);
      lastState = state;
    }
    const kick = last.stats?.instances.find((instance) => instance.name === "kick");
    const onsets = (kick?.onsetCount ?? 0) - baseline;
    // Loop: a kick every beat. Song: none in break; at least the kicks of the whole passes.
    const expectedAtLeast =
      mode === "loop"
        ? Math.floor(((SECONDS - 1) * ONBOARD_BPM) / 60)
        : Math.floor((SECONDS - 1) / ((PASS_BARS * 240) / ONBOARD_BPM)) * KICK_BARS_PER_PASS * 4;
    writeMeasurement(`drift-${mode}`, {
      mode,
      seconds: SECONDS,
      reads,
      checkedReads,
      sampleRate: last.sampleRate,
      startFrame: last.startFrame,
      kickOnsets: onsets,
      expectedKickOnsetsAtLeast: expectedAtLeast,
      worstDriftSamples: worstDrift,
      invalidEditAtMs: invalidAt,
      gainEditAtMs: gainAt,
      counters: counters(last.stats),
      underrunEvents: last.underruns,
      failures,
    });
    expect(failures).toEqual([]);
    expect(invalidAt).not.toBeNull();
    expect(gainAt).not.toBeNull();
    expect(checkedReads, "reads that checked the kick frame").toBeGreaterThan(reads / 2);
    expect(onsets).toBeGreaterThanOrEqual(expectedAtLeast);
  });
}
