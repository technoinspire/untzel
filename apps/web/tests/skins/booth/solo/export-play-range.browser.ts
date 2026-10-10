// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's stretch: the sheet starts from the play
// range (bars 5–8 of an 8-bar loop at 132 BPM), the start handle is dragged half a bar in,
// to bar 5 beat 3, and a real Story renders from there. The file lasts the stretch plus
// the 2 s card, ±1 frame, and its sound matches the WAV of the same stretch (the
// deterministic engine; tools/sim proves that one equal to the simulator to the sample).
// Then the caps: a 128-bar song at 40 BPM is cut to 10:00 for the video and to 1:00 for the
// Story, and a handle stops there. The music keeps playing throughout.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { inspectMp4, openExport, renderExport, saveExport, seedDeviceProbe } from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { expectSoundThroughout, startRms, startSession, stopRms } from "../support/session-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../support/support";

const FFPROBE = "/opt/homebrew/bin/ffprobe";
const FFMPEG = "/opt/homebrew/bin/ffmpeg";
const EXPORTS = fileURLToPath(new URL("../../../../../../.cache/exports/", import.meta.url));
const FRAMES_PER_BAR = (240 * 48_000) / 132;
/** Ticks of 1/64 bar: bar 5 beat 3 is 4.5 bars in; the end, the end of bar 8. */
const START_TICK = 288;
const END_TICK = 512;
const frameOf = (tick: number): number => Math.floor((tick / 64) * FRAMES_PER_BAR);
const MUSIC_FRAMES = frameOf(END_TICK) - frameOf(START_TICK);
// 128 bars at 40 BPM, past both caps. The hat plays every sixteenth in both sections: with
// the kick alone, one hit every 1.5 s, the intro rests up to a second between kicks (47 % of
// its 500 ms windows at or under the RMS gate in the simulator, 05/10/2026), and the sound
// check would measure the music's rests instead of a cut.
const LONG_SONG = [
  "tempo 40",
  "key c minor",
  "kick:  kick  x... x... x... x...",
  "hat:   hat   xxxx xxxx xxxx xxxx",
  "section intro  kick hat",
  "section drop   kick hat",
  "song intro 64, drop 64",
].join("\n");

async function setUpRange(page: Page): Promise<void> {
  await page.getByRole("button", { name: /^Loop length/ }).click();
  const picker = page.getByRole("dialog", { name: /length/i });
  await picker.getByRole("button", { name: "8 bars", exact: true }).click();
  await expect(picker).toBeHidden();
  const start = page.locator(".ui-transport").getByRole("group", { name: "Play range" }).getByRole("slider", { name: "Range start" });
  await expect(start).toHaveAttribute("aria-valuemax", "8", { timeout: 5_000 });
  await start.focus();
  for (let bar = 1; bar < 5; bar += 1) await start.press("ArrowRight");
  await expect(page.locator(".ui-range-row__label")).toHaveText("Range: bars 5–8");
}

/** Drags a handle of the export ruler to `bars` from its left edge, in a few moves. */
async function dragHandle(page: Page, ruler: Locator, handle: Locator, bars: number, lastBar: number): Promise<void> {
  const track = await ruler.locator(".ui-range-ruler__track").boundingBox();
  const box = await handle.boundingBox();
  if (track === null || box === null) throw new Error("no ruler");
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(track.x + (bars / lastBar) * track.width, y, { steps: 8 });
  await page.mouse.up();
}

/** Mono samples of a file, decoded by ffmpeg at 48 kHz, through a temporary raw file. */
function samplesOf(path: string, name: string): Float32Array {
  const raw = `${EXPORTS}${name}.f32`;
  execFileSync(FFMPEG, ["-v", "error", "-y", "-i", path, "-map", "0:a:0", "-ac", "1", "-ar", "48000", "-f", "f32le", raw]);
  const bytes = readFileSync(raw);
  rmSync(raw, { force: true });
  return new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
}

/** The lag (±1 ms) that best lines up `a` with `b` over 200 ms after the fade-in, its correlation and the level difference in dB. */
function compare(a: Float32Array, b: Float32Array): { readonly lag: number; readonly correlation: number; readonly levelDb: number } {
  const from = 480;
  const length = 9_600;
  let best = { lag: 0, correlation: -1 };
  for (let lag = -48; lag <= 48; lag += 1) {
    let ab = 0;
    let aa = 0;
    let bb = 0;
    for (let index = from; index < from + length; index += 1) {
      const x = a[index] ?? 0;
      const y = b[index + lag] ?? 0;
      ab += x * y;
      aa += x * x;
      bb += y * y;
    }
    const correlation = ab / Math.sqrt(aa * bb || 1);
    if (correlation > best.correlation) best = { lag, correlation };
  }
  const rms = (values: Float32Array) => Math.sqrt(values.subarray(from, from + length).reduce((sum, value) => sum + value * value, 0) / length);
  return { ...best, levelDb: 20 * Math.log10(rms(a) / rms(b)) };
}

for (const width of [390, 1440] as const) {
  test(`the export's stretch at ${width}: a Story from bar 5 beat 3, its length and its sound`, async ({ page }) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startSession(page);
    await seedDeviceProbe(page, false);
    await startRms(page);
    await setUpRange(page);
    const sheet = await openExport(page);
    const ruler = sheet.getByRole("group", { name: "Export range" });
    const start = ruler.getByRole("slider", { name: "Range start" });
    const end = ruler.getByRole("slider", { name: "Range end" });
    const status = page.locator(".ui-app > [role='status']");
    await expect(sheet.getByRole("button", { name: /^Story/ })).toHaveAttribute("aria-pressed", "true");
    // The play range in words while the stretch is it; a handle moved hides them.
    await expect(sheet.locator(".ui-export__selected")).toHaveText("Bars 5–8");
    await expect(sheet.locator(".ui-export__readout")).toHaveText("0:07.3 · bar 5.1 → 0:14.5 · bar 9.1");
    await expect(sheet.locator(".ui-export__cap")).toHaveText("Story up to 1:00");
    await expect(sheet.getByRole("button", { name: "Use play range" })).toHaveAttribute("aria-disabled", "true");

    // Half a bar in, by the pointer: the handle snaps to the step, the times follow live.
    await dragHandle(page, ruler, start, 4.5, 8);
    await expect(start).toHaveAttribute("aria-valuetext", "Start, 0:08.2, bar 5 beat 3");
    await expect(sheet.locator(".ui-export__selected")).toBeHidden();
    await expect(sheet.locator(".ui-export__readout")).toHaveText("0:08.2 · bar 5.3 → 0:14.5 · bar 9.1");
    await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 5.3 · 3.5 bars");
    await expect(sheet.locator(".ui-export__status")).toHaveText("0:06 + 2 s · not rendered");
    await expect(status).toHaveText("Export from 0:08.2 to 0:14.5.");
    await expect(sheet.getByRole("button", { name: "Use play range" })).not.toHaveAttribute("aria-disabled", "true");
    // A key moves the end one step and says nothing; the slider says its value.
    await end.focus();
    await end.press("ArrowLeft");
    await expect(end).toHaveAttribute("aria-valuetext", "End, 0:14.4, bar 8 beat 4 step 4");
    await expect(status).toHaveText("Export from 0:08.2 to 0:14.5.");
    await screenshot(page, "export-stretch", width);
    await end.press("ArrowRight");
    await expect(end).toHaveAttribute("aria-valuetext", "End, 0:14.5, bar 9 beat 1");

    if (width === 390) {
      const elapsedMs = await renderExport(page, 120_000);
      await saveExport(page, "story-stretch.mp4");
      const story = `${EXPORTS}story-stretch.mp4`;
      const probe = JSON.parse(execFileSync(FFPROBE, ["-v", "error", "-show_entries", "stream=codec_type,nb_frames,duration,width,height:format=duration", "-of", "json", story], { encoding: "utf8" })) as {
        streams: { codec_type: string; nb_frames?: string; duration?: string; width?: number; height?: number }[];
      };
      execFileSync(FFMPEG, ["-v", "error", "-y", "-i", story, "-frames:v", "1", `${EXPORTS}story-stretch-first-frame.png`]);
      const video = probe.streams.find((stream) => stream.codec_type === "video");
      const total = Math.ceil(MUSIC_FRAMES / 1_600) + 60;
      const expectedSeconds = MUSIC_FRAMES / 48_000 + 2;
      const report = await inspectMp4(page);
      expect(video?.width).toBe(1080);
      expect(Number(video?.nb_frames)).toBe(total);
      expect(Math.abs(Number(video?.duration) - expectedSeconds), "the stretch plus the card, ±1 frame").toBeLessThanOrEqual(1 / 30);
      // The card is the last 60 of `total` frames, checked above by count. Its pixels and
      // the mark's belong to export.browser.ts and export-quality.browser.ts, whose
      // references changed with the lockup.
      expect(report.cardFrames.length, "the card's frames were read").toBeGreaterThan(0);
      // The same stretch as a WAV: the deterministic engine, without the AAC.
      await sheet.getByRole("button", { name: /^Audio/ }).click();
      await renderExport(page, 120_000);
      await saveExport(page, "story-stretch-reference.wav");
      const wav = samplesOf(`${EXPORTS}story-stretch-reference.wav`, "wav");
      const mp4 = samplesOf(story, "mp4");
      rmSync(`${EXPORTS}story-stretch-reference.wav`, { force: true });
      const match = compare(mp4, wav);
      writeMeasurement("export-test-story-stretch", { elapsedMs, story, probe, expectedFrames: total, expectedSeconds, musicFrames: MUSIC_FRAMES, startTick: START_TICK, endTick: END_TICK, match, firstWavSample: wav[0], wavPeakInFade: Math.max(...Array.from(wav.subarray(0, 48), Math.abs)) });
      expect(Math.abs(wav[0] ?? 1), "the 10 ms fade-in starts at silence").toBeLessThan(1e-4);
      expect(Math.abs(match.lag), "the MP4 starts on the WAV's sample, ±1 ms").toBeLessThanOrEqual(48);
      expect(match.correlation, "the MP4 sounds as the WAV").toBeGreaterThan(0.9);
      expect(Math.abs(match.levelDb), "same level, ±1.5 dB").toBeLessThan(1.5);
    }
    expectSoundThroughout(await stopRms(page, 4), "dragging the export's stretch and its renders");
    expect(errors).toEqual([]);
  });
}

test("the export's stretch stops at 10:00 for the video and at 1:00 for the Story", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startSession(page);
  await startRms(page);
  await page.evaluate((text) => (globalThis as unknown as { untzelTest: { applyText(text: string): unknown } }).untzelTest.applyText(text), LONG_SONG);
  await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: /^Video/ }).click();
  // Without a play range Selected range waits to be chosen; it copies the whole song.
  await sheet.getByRole("button", { name: "Selected range" }).click();
  await expect(sheet.getByRole("button", { name: "Use whole song" })).toHaveAttribute("aria-disabled", "true");
  const ruler = sheet.getByRole("group", { name: "Export range" });
  const status = page.locator(".ui-app > [role='status']");
  // 128 bars at 40 BPM are 12:48: the video takes the first 10:00, bars 1 to 100.
  await expect(sheet.locator(".ui-export__readout")).toHaveText("0:00.0 · bar 1.1 → 10:00.0 · bar 101.1");
  await expect(sheet.locator(".ui-export__cap")).toHaveText("Video up to 10:00");
  await dragHandle(page, ruler, ruler.getByRole("slider", { name: "Range end" }), 128, 128);
  await expect(sheet.locator(".ui-export__readout")).toHaveText("0:00.0 · bar 1.1 → 10:00.0 · bar 101.1");
  await expect(status).toHaveText("Export from 0:00.0 to 10:00.0. Video up to 10:00.");
  await sheet.getByRole("button", { name: /^Story/ }).click();
  await expect(sheet.locator(".ui-export__readout")).toHaveText("0:00.0 · bar 1.1 → 1:00.0 · bar 11.1");
  await expect(sheet.locator(".ui-export__cap")).toHaveText("Story up to 1:00");
  await expect(status).toHaveText("Story up to 1:00: the export range now ends there.");
  await screenshot(page, "export-stretch-cap", 1440);
  expectSoundThroughout(await stopRms(page), "the caps of the export's stretch");
  expect(errors).toEqual([]);
});
