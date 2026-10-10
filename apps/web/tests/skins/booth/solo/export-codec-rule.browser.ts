// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export's codec rule in the real export worker, with WebCodecs stubbed inside it
// (the worker script is served with a stub in front; addInitScript does not reach workers):
//   - the H.264 probe misses its deadline twice (a busy machine) and then encodes: the file
//     is still H.264 High with AAC, read back with ffprobe, never VP9;
//   - H.264 refused by every encoder: the sheet says so, offers no MP4 and no retry, Story
//     and Video go inert, and the Audio WAV still renders.
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { details, openExport, renderExport, saveExport, seedDeviceProbe } from "../support/export-support";
import { writeMeasurement } from "../support/measure-support";
import { PHASE1_ONBOARD_PATH, startEngine, stopMusic } from "../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../support/support";

const FFPROBE = "/opt/homebrew/bin/ffprobe";
const EXPORTS = fileURLToPath(new URL("../../../../../../.cache/exports/", import.meta.url));

/**
 * The codec probe encodes two frames and the warm-up one; the render's encoder many. Both
 * small flushes hang, like an encoder that misses its deadline: the warm-up always, the
 * probe on its first two attempts.
 */
const SLOW_PROBE = `(() => {
  const Native = globalThis.VideoEncoder;
  let hung = 0;
  globalThis.VideoEncoder = class extends Native {
    #frames = 0;
    encode(frame, options) { this.#frames += 1; return super.encode(frame, options); }
    flush() {
      if (this.#frames === 1) return new Promise(() => undefined);
      if (this.#frames === 2 && hung < 2) { hung += 1; return new Promise(() => undefined); }
      return super.flush();
    }
  };
})();
`;
/** No H.264 at all, on any encoder: isConfigSupported says no to every avc1 configuration. */
const NO_H264 = `(() => {
  const Native = globalThis.VideoEncoder;
  globalThis.VideoEncoder = class extends Native {
    static isConfigSupported(config) {
      return String(config.codec).startsWith("avc1") ? Promise.resolve({ supported: false, config }) : Native.isConfigSupported(config);
    }
  };
})();
`;

async function stubExportWorker(page: Page, stub: string): Promise<void> {
  await page.route("**/assets/export.worker-*.js", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: stub + (await response.text()) });
  });
}

function videoStream(path: string): { readonly codec: string; readonly profile: string; readonly audio: string } {
  const json = execFileSync(FFPROBE, ["-v", "error", "-show_streams", "-of", "json", path], { encoding: "utf8" });
  const streams = (JSON.parse(json) as { streams: { codec_type: string; codec_name: string; profile?: string }[] }).streams;
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  return { codec: video?.codec_name ?? "", profile: video?.profile ?? "", audio: audio?.codec_name ?? "" };
}

test("an H.264 probe that misses its deadline twice is retried and the story is still H.264 High", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await stubExportWorker(page, SLOW_PROBE);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  await stopMusic(page);
  await openExport(page);
  const elapsedMs = await renderExport(page, 90_000);
  await saveExport(page, "codec-retry-story.mp4");
  const path = `${EXPORTS}codec-retry-story.mp4`;
  const streams = videoStream(path);
  const rendered = await details(page);
  writeMeasurement("export-test-codec-retry", { elapsedMs, path, streams, codecs: rendered?.codecs, renderMs: rendered?.renderMs, codecRetryMs: rendered?.codecRetryMs });
  expect(streams).toEqual({ codec: "h264", profile: "High", audio: "aac" });
  expect(rendered?.codecs).toBe("avc1.640028, mp4a.40.2");
  // Two missed deadlines and their backoffs: at least the 6 s one and 1.5 s of waits.
  expect(rendered?.codecRetryMs ?? 0, "the retry time, reported apart from the render").toBeGreaterThanOrEqual(7_000);
  expect(errors).toEqual([]);
});

test("without H.264 the sheet says so and offers no MP4; the Audio WAV still renders", async ({ page }) => {
  test.setTimeout(120_000);
  await stubExportWorker(page, NO_H264);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page, PHASE1_ONBOARD_PATH);
  await seedDeviceProbe(page, false);
  await stopMusic(page);
  const sheet = await openExport(page);
  await sheet.getByRole("button", { name: "Render", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("This device can't encode H.264 video. Try the Audio WAV export or another browser.", { timeout: 60_000 });
  await expect(sheet.getByRole("button", { name: "Download" })).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "Try again" })).toBeHidden();
  await expect(sheet.getByRole("button", { name: /^Story/ })).toHaveAttribute("aria-disabled", "true");
  await expect(sheet.getByRole("button", { name: /^Video/ })).toHaveAttribute("aria-disabled", "true");
  const file = await page.evaluate(() => (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest.exportFile()?.name ?? null);
  expect(file, "no MP4 is kept").toBeNull();
  await sheet.getByRole("button", { name: /^Audio/ }).click();
  await renderExport(page);
  const audio = await page.evaluate(() => (globalThis as unknown as { untzelTest: { exportFile(): File | null } }).untzelTest.exportFile()?.name ?? "");
  expect(audio).toMatch(/\.wav$/);
});
