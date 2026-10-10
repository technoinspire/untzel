// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The .untzel file: save (download path), open it back, drag and drop, refuse what is not a song.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { ONBOARD, applyText, edited, expectAnnounced, expectPlaysRange, openShare, rangeLabel, session, setPlayRange, startEngine, tapToPlay, watchBars } from "../../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

/** Chrome has showSaveFilePicker; without a person to answer it, the test takes the download path. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
});

async function saveFile(page: Page): Promise<{ readonly name: string; readonly text: string }> {
  await openShare(page);
  const download = page.waitForEvent("download");
  await page.locator("#ui-share").getByRole("button", { name: "Save file" }).click();
  const file = await download;
  const path = await file.path();
  await page.keyboard.press("Escape");
  return { name: file.suggestedFilename(), text: readFileSync(path, "utf8") };
}

async function drop(page: Page, name: string, type: string, text: string): Promise<void> {
  await page.evaluate(
    ({ name, type, text }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([text], name, { type }));
      const app = document.querySelector(".ui-app");
      if (app === null) throw new Error("no app");
      app.dispatchEvent(new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }));
      app.dispatchEvent(new DragEvent("dragover", { dataTransfer: transfer, bubbles: true, cancelable: true }));
      if (app.getAttribute("data-dropping") !== "true") throw new Error("no drop hint while dragging");
      app.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true }));
    },
    { name, type, text },
  );
}

test("Save file downloads the text with its format line, and Open file brings it back", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  const text = edited(126);
  await applyText(page, text);
  const saved = await saveFile(page);
  // Named from the song's title.
  expect(saved.name).toBe("midnight-bloom.untzel");
  // The sender's mode on the format line, beside the text.
  expect(saved.text).toBe(`// untzel 1 mode=loop\n${text}`);
  await applyText(page, ONBOARD);
  await page.locator('input[type="file"]').setInputFiles({ name: saved.name, mimeType: "text/plain", buffer: Buffer.from(saved.text) });
  await expectAnnounced(page, `${saved.name} plays on the next bar.`);
  const now = await session(page);
  expect(now.source).toBe(text);
  expect(now.source.startsWith("// untzel")).toBe(false);
  expect(errors).toEqual([]);
});

// The range rides on the format line, beside the mode.
test("Save file carries the play range, and Open file brings it back with the text", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  await setPlayRange(page, 2, 3);
  await expect(rangeLabel(page)).toHaveText("Range: bars 2–3");
  const saved = await saveFile(page);
  expect(saved.text).toBe(`// untzel 1 mode=loop range=2-3\n${ONBOARD}`);
  await page.evaluate(() => (globalThis as unknown as { untzelTest: { exportPlayRange(range: null): void } }).untzelTest.exportPlayRange(null));
  await expect(rangeLabel(page)).not.toHaveText("Range: bars 2–3");
  await page.locator('input[type="file"]').setInputFiles({ name: saved.name, mimeType: "text/plain", buffer: Buffer.from(saved.text) });
  await expectAnnounced(page, `${saved.name} plays on the next bar.`);
  await expect(rangeLabel(page)).toHaveText("Range: bars 2–3");
  expect((await session(page)).source).toBe(ONBOARD);
  // On the waiting stage: the tap plays from the range's first bar.
  await page.goto("about:blank");
  await page.goto("./");
  await page.locator('input[type="file"]').setInputFiles({ name: saved.name, mimeType: "", buffer: Buffer.from(saved.text) });
  await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
  await watchBars(page);
  await tapToPlay(page);
  await expectPlaysRange(page, 2, 3);
  await expect(rangeLabel(page)).toHaveText("Range: bars 2–3");
  expect(errors).toEqual([]);
});
test("Save file keeps an invalid text as it is: work in progress", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  const broken = `${ONBOARD}\nkick: x... ~~~`;
  await applyText(page, broken);
  expect((await session(page)).valid).toBe(false);
  expect((await saveFile(page)).text).toBe(`// untzel 1 mode=loop\n${broken}`);
});

test("a dropped file plays on the next bar; a file that is not a song changes nothing", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[1440]);
  await startEngine(page);
  await drop(page, "photo.png", "image/png", "not a song");
  await expectAnnounced(page, "This file is not an Untzel song.");
  expect((await session(page)).source).toBe(ONBOARD);
  await drop(page, "broken.untzel", "", "// untzel 1\nkick: x... ~~~");
  await expect(page.locator(".ui-app [aria-live]")).toHaveText(/^This file has errors: /, { timeout: 5_000 });
  expect((await session(page)).source).toBe(ONBOARD);
  await drop(page, "dropped.untzel", "", `// untzel 1\n${edited(128)}`);
  await expectAnnounced(page, "dropped.untzel plays on the next bar.");
  expect((await session(page)).source).toBe(edited(128));
  await expect(page.locator(".ui-app")).not.toHaveAttribute("data-dropping", "true");
  expect(errors).toEqual([]);
});

test("a file opened on the waiting stage plays on the tap, in the mode it carries or by the fallback", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  // [format line, mode]: the onboard has a `song` line, so without a mode it opens in song.
  const cases = [
    ["// untzel 1 mode=loop\n", "loop"],
    ["// untzel 1 mode=song\n", "song"],
    ["// untzel 1\n", "song"],
  ] as const;
  for (const [line, mode] of cases) {
    await page.goto("about:blank");
    await page.goto("./");
    await page.locator('input[type="file"]').setInputFiles({ name: "song.untzel", mimeType: "", buffer: Buffer.from(`${line}${edited(122)}`) });
    await expect(page.getByText("Remix this", { exact: true })).toBeVisible();
    await tapToPlay(page);
    expect(await session(page), JSON.stringify(line)).toMatchObject({ source: edited(122), mode });
  }
});
