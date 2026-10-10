// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The WAV export: header and length exact, the attribution in LIST/INFO, and the music
// what the Node simulator renders for the same 16 bars of the phase 1 onboard (132 BPM),
// whose numbers this test is about.
//
// Since the hat is recorded, the onboard's `hat` and `ride`
// play a sample pack. The page decodes the pack's Opus with decodeAudioData and the
// simulator with libopus in WASM: two decoders, a few LSB apart. So the export
// and the simulator are compared twice:
//   - the same 16 bars with the hats on synthesis (`source synth`): the DSP host, the WASM
//     and the plan, bit for bit, as before the recorded hat;
//   - the onboard as it is, with the pack: within the decoders' difference of the
//     simulator, and far from the synthesised hats, so the pack did reach the export.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { openExport, renderExport } from "../support/export-support";
import { PHASE1_ONBOARD_PATH, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";

const REPO = fileURLToPath(new URL("../../../../../../", import.meta.url));
const PHASE1_ONBOARD_FILE = "tools/sim/fixtures/phase1-onboard.untzel";
const MUSIC_FRAMES = Math.floor((16 * 240 * 48_000) / 132);
const WAV_HEADER_BYTES = 44;
const FULL_SCALE = 8_388_607;
/**
 * Chrome's decodeAudioData against the simulator's libopus, on the recorded hat: 1.3e-5 of
 * full scale at most (112 LSB at 24 bits, -97 dBFS), measured 05/10/2026. The bound is
 * -78 dBFS, about nine times that, and far below anything audible.
 */
const DECODER_BOUND = 1 / 8_192;
/** The recorded hat against the synthesised one: 0.38 of full scale at most, measured. */
const RECORDED_AGAINST_SYNTH = 0.05;

interface WavExport {
  readonly report: Record<string, unknown>;
  readonly bytes: Buffer;
}

function fnv(bytes: Uint8Array, from: number, to: number): number {
  let hash = 0x811c9dc5;
  for (let offset = from; offset < to; offset += 1) hash = Math.imul(hash ^ (bytes[offset] ?? 0), 0x01000193) >>> 0;
  return hash;
}

/** The onboard with every `hat` track on synthesis: the sound before the recorded hat. */
function withSynthesisedHats(text: string): string {
  return text
    .split("\n")
    .map((line) => (/^\w+:\s+hat\s/.test(line) ? `${line} | source synth` : line))
    .join("\n");
}

/** The simulator's WAV of 16 bars of `text`. */
function simulatedWav(text: string): Buffer {
  const out = mkdtempSync(join(tmpdir(), "untzel-wav-"));
  try {
    const file = join(out, "input.untzel");
    writeFileSync(file, text);
    execFileSync("node", ["tools/sim/bin/sim.mjs", file, "--bars", "16", "--out", out], { cwd: REPO, stdio: "pipe" });
    return readFileSync(join(out, "audio.wav"));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** The largest difference between two 24-bit stereo WAVs over the music, as a share of full scale. */
function largestDifference(left: Uint8Array, right: Uint8Array): number {
  const sample = (bytes: Uint8Array, offset: number) => ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16)) << 8 >> 8;
  let largest = 0;
  for (let offset = WAV_HEADER_BYTES; offset < WAV_HEADER_BYTES + MUSIC_FRAMES * 6; offset += 3) {
    largest = Math.max(largest, Math.abs(sample(left, offset) - sample(right, offset)));
  }
  return largest / FULL_SCALE;
}

/** Renders 16 bars of audio from the sheet, stopped: the report of the export lab and the file's bytes. */
async function exportWav(page: Page): Promise<WavExport> {
  await stopMusic(page);
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: /^Audio/ }).click();
  await expect(sheet.locator(".ui-export__origin")).toHaveText("from bar 1 · 16 bars");
  await renderExport(page);
  await expect(sheet.locator(".ui-export__status")).toHaveText(/^Ready · 0:29 · WAV · /);
  const { report, base64 } = await page.evaluate(async (frames) => {
    const hooks = (globalThis as unknown as { untzelTest: { exportFile(): File | null; exportLab(): Promise<{ inspectWav(file: Blob, frames: number): Promise<Record<string, unknown>> }> } }).untzelTest;
    const file = hooks.exportFile();
    if (file === null) throw new Error("no export");
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    return { report: { name: file.name, ...(await (await hooks.exportLab()).inspectWav(file, frames)) }, base64: btoa(binary) };
  }, MUSIC_FRAMES);
  return { report, bytes: Buffer.from(base64, "base64") };
}

test("the WAV of 16 bars: exact header and length, attribution, the simulator's samples within the Opus decoders' difference", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  const { report, bytes } = await exportWav(page);
  // A text played without a title line gets "Untitled": the file is named from it.
  expect(report["name"]).toMatch(/^untitled-audio-\d{8}-\d{4}\.wav$/);
  expect(report).toMatchObject({ riff: "RIFFWAVE", channels: 2, sampleRate: 48_000, bitsPerSample: 24 });
  expect(report["riffSize"]).toBe((report["fileSize"] as number) - 8);
  expect(report["dataBytes"]).toBe((report["frames"] as number) * 6);
  const frames = report["frames"] as number;
  expect(frames).toBeGreaterThanOrEqual(MUSIC_FRAMES);
  expect(frames).toBeLessThanOrEqual(MUSIC_FRAMES + 4 * 48_000);
  expect(report["info"]).toContain("Powered by Untzel · Techno Inspire · https://untzel.com");
  const onboard = readFileSync(join(REPO, PHASE1_ONBOARD_FILE), "utf8");
  expect(largestDifference(bytes, simulatedWav(onboard)), "against the simulator, with the recorded hat").toBeLessThanOrEqual(DECODER_BOUND);
  expect(largestDifference(bytes, simulatedWav(withSynthesisedHats(onboard))), "against the synthesised hats").toBeGreaterThanOrEqual(RECORDED_AGAINST_SYNTH);
  expect(errors).toEqual([]);
});

test("the WAV of 16 bars with the hats on synthesis: the simulator's samples, bit for bit", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  const text = withSynthesisedHats(readFileSync(join(REPO, PHASE1_ONBOARD_FILE), "utf8"));
  await page.evaluate((next) => (globalThis as unknown as { untzelTest: { applyText(text: string): void } }).untzelTest.applyText(next), text);
  await expect
    .poll(() => page.evaluate(() => (globalThis as unknown as { untzelTest: { session(): { readonly source: string; readonly valid: boolean } } }).untzelTest.session()))
    .toMatchObject({ source: text, valid: true });
  const { report } = await exportWav(page);
  const simulated = simulatedWav(text);
  expect(fnv(simulated, WAV_HEADER_BYTES, WAV_HEADER_BYTES + MUSIC_FRAMES * 6)).toBe(report["pcmHash"]);
  expect(errors).toEqual([]);
});
