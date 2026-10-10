// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// In the real page, a choir track sings on the formants (centred) while its
// sample pack downloads, then on the recorded ensemble (spread) from the next bar after
// the pack reached the worklet, with no console error and without the music stopping.
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

interface Hooks {
  applyText(text: string): unknown;
  stats(): { lateDrops: number; queueDrops: number; nanResets: number; unknownTargets: number; unknownMessages: number } | null;
  contextState(): string;
  startFrame(): number | null;
  currentFrame(): number;
  sampleRate(): number;
  stereo(): { mid: number; side: number };
  samplesLoaded(): { instrumentId: number; atFrame: number | null }[];
  session(): { playing: boolean };
}

const CHOIR_TEXT = "tempo 120\nkey c minor\nchoir: choir Cm ~ ~ ~ / Ab ~ Bb ~\n";
/** (L − R) against (L + R): the formants are centred, the two stems ±0.55 apart are not. */
const CENTRED = 0.05;
const SPREAD = 0.15;

const call = <T>(page: Page, name: keyof Hooks) =>
  page.evaluate((hook) => {
    const hooks = (globalThis as unknown as { untzelTest: Record<string, () => unknown> }).untzelTest;
    return hooks[hook]?.() as T;
  }, name);

/** The widest side/mid ratio heard over `ms`, while the choir sounds. */
async function widest(page: Page, ms: number): Promise<{ ratio: number; mid: number }> {
  let ratio = 0;
  let mid = 0;
  for (let elapsed = 0; elapsed < ms; elapsed += 100) {
    await page.waitForTimeout(100);
    const reading = await call<{ mid: number; side: number }>(page, "stereo");
    mid = Math.max(mid, reading.mid);
    if (reading.mid > 0.002) ratio = Math.max(ratio, reading.side / reading.mid);
  }
  return { ratio, mid };
}

test("a choir sings on the formants until its pack arrives, then on the samples, without stopping", async ({ page }) => {
  const errors = collectErrors(page);
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  let requested = 0;
  await page.route("**/pack*.opus", async (route) => {
    requested += 1;
    await held;
    await route.continue();
  });
  await page.setViewportSize(VIEWPORTS[1440]);
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.waitForFunction(() => {
    const t = (globalThis as unknown as { untzelTest?: Hooks }).untzelTest;
    return t !== undefined && t.contextState() === "running" && t.startFrame() !== null;
  });
  await page.evaluate((text) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.applyText(text), CHOIR_TEXT);
  // The new text plays from the next bar (2 s at 120 BPM); the onboard's reverb tails
  // (stereo) die out first. The pack is still held.
  await page.waitForTimeout(8_000);
  const formant = await widest(page, 2_000);
  expect(requested, "the pack was asked for").toBeGreaterThan(0);
  expect(await call<unknown[]>(page, "samplesLoaded")).toEqual([]);
  expect(formant.mid, "the choir sounds before its pack").toBeGreaterThan(0.005);
  console.log(`formant: side/mid ${formant.ratio.toFixed(3)}, mid ${formant.mid.toFixed(3)}`);
  expect(formant.ratio, "formants are centred").toBeLessThan(CENTRED);

  release();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.samplesLoaded().length > 0, undefined, { timeout: 20_000 });
  const [loaded] = await call<{ instrumentId: number; atFrame: number | null }[]>(page, "samplesLoaded");
  expect(loaded?.atFrame, "the worklet took the pack").not.toBeNull();
  const sampleRate = await call<number>(page, "sampleRate");
  // From the next bar on, the next chord starts on the samples (chords change every 2 s).
  await page.waitForFunction(
    (frame) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.currentFrame() > frame,
    (loaded?.atFrame ?? 0) + 1.2 * sampleRate,
  );
  const sampled = await widest(page, 2_000);
  expect(sampled.mid, "the choir still sounds").toBeGreaterThan(0.005);
  console.log(`samples from frame ${loaded?.atFrame ?? "?"}: side/mid ${sampled.ratio.toFixed(3)}, mid ${sampled.mid.toFixed(3)}`);
  expect(sampled.ratio, "the recorded ensemble is spread").toBeGreaterThan(SPREAD);

  expect((await call<{ playing: boolean }>(page, "session")).playing, "the transport never stopped").toBe(true);
  expect(await call<ReturnType<Hooks["stats"]>>(page, "stats")).toMatchObject({ lateDrops: 0, queueDrops: 0, nanResets: 0, unknownTargets: 0, unknownMessages: 0 });
  expect(errors).toEqual([]);
});
