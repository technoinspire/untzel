// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The composer terminal on the
// real session at 390 and 1440: open the terminal, `add bass` and `tempo 124` change the
// text and enter on the next bar, `remove ride` shows a preview and Cancel leaves the
// text alone, `tmepo 124` suggests `tempo 124`, the editor's quick fix turns "kik" into
// "kick", Up walks the history, the music never stops (AnalyserNode RMS in every
// 500 ms), the attribution stays visible and the console stays clean. Captures of every
// state at 390, 768, 1024 and 1440.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors, expectAttribution, screenshot, type ViewportWidth } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  rms(): number;
  applyText(text: string): void;
  session(): { readonly source: string; readonly valid: boolean; readonly tempo: number | null };
}

const RMS_THRESHOLD = 0.005;
const RMS_SLICE_MS = 500;
/** One bar at 132 BPM is 1.82 s; the next bar comes within two. */
const NEXT_BAR_MS = 4_000;

const view = (page: Page) =>
  page.evaluate(() => {
    const state = (globalThis as unknown as { untzelTest: Hooks }).untzelTest.session();
    return { source: state.source, valid: state.valid, tempo: state.tempo };
  });

async function startRms(page: Page): Promise<void> {
  await page.evaluate(() => {
    const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
    const samples: { at: number; rms: number }[] = [];
    const timer = window.setInterval(() => samples.push({ at: performance.now(), rms: t.rms() }), 25);
    (globalThis as unknown as Record<string, unknown>)["untzelTerminalRms"] = { samples, timer };
  });
}

async function stopRms(page: Page): Promise<{ quietestSlice: number; slices: number }> {
  return page.evaluate((sliceMs) => {
    const record = (globalThis as unknown as { untzelTerminalRms: { samples: { at: number; rms: number }[]; timer: number } }).untzelTerminalRms;
    window.clearInterval(record.timer);
    const first = record.samples[0]?.at ?? 0;
    const last = record.samples.at(-1)?.at ?? 0;
    const loudest = new Map<number, number>();
    for (const sample of record.samples) {
      const slice = Math.floor((sample.at - first) / sliceMs);
      loudest.set(slice, Math.max(loudest.get(slice) ?? 0, sample.rms));
    }
    const whole = [...loudest.entries()].filter(([slice]) => (slice + 1) * sliceMs <= last - first);
    return { quietestSlice: Math.min(...whole.map(([, rms]) => rms)), slices: whole.length };
  }, RMS_SLICE_MS);
}

async function start(page: Page, width: ViewportWidth): Promise<void> {
  await page.setViewportSize(VIEWPORTS[width]);
  // The phase 1 onboard (132 BPM, ride, no loop section), as the other session tests;
  // the first-touch template of the library has its own tempo and tracks.
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
}

/** Code next to Drop, then the Commands toggle, closed by default. */
async function openTerminal(page: Page): Promise<Locator> {
  await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator("#ui-code .ut-area")).toBeVisible();
  const toggle = page.getByRole("button", { name: "Commands" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const input = page.getByRole("combobox", { name: "Command" });
  await expect(input).toBeVisible();
  return input;
}

/** The preview's header, first diff line and buttons lie inside the log's visible rect. */
async function expectPreviewInView(page: Page): Promise<void> {
  const boxes = await page.evaluate(() => {
    const log = document.querySelector(".ut-log")?.getBoundingClientRect();
    const box = (selector: string) => {
      const rect = document.querySelector(`.ut-preview--open ${selector}`)?.getBoundingClientRect();
      return rect === undefined ? null : { top: rect.top, bottom: rect.bottom };
    };
    return {
      log: log === undefined ? null : { top: log.top, bottom: log.bottom },
      parts: { header: box(".ut-preview__title"), "first diff line": box(".ut-diff__line"), "Apply and Cancel": box(".ut-preview__actions") },
    };
  });
  expect(boxes.log, "the log is laid out").not.toBeNull();
  for (const [name, part] of Object.entries(boxes.parts)) {
    expect(part, `${name} is drawn`).not.toBeNull();
    expect(part?.top ?? -1, `${name} starts inside the log`).toBeGreaterThanOrEqual((boxes.log?.top ?? 0) - 0.5);
    expect(part?.bottom ?? Infinity, `${name} ends inside the log`).toBeLessThanOrEqual((boxes.log?.bottom ?? 0) + 0.5);
  }
}

/** The field and Run lie inside the terminal and are what a tap at their bottom edge hits. */
async function expectLineInPane(page: Page): Promise<void> {
  const problems = await page.evaluate(() => {
    const pane = document.querySelector(".ut-terminal")?.getBoundingClientRect();
    if (pane === undefined) return ["no terminal"];
    return [".ut-prompt", ".ut-run"].flatMap((selector) => {
      const node = document.querySelector(selector);
      const rect = node?.getBoundingClientRect();
      if (node == null || rect === undefined) return [`${selector} missing`];
      // The desktop has no Run button: Enter runs.
      if (selector === ".ut-run" && getComputedStyle(node).display === "none") return [];
      if (rect.top < pane.top - 0.5 || rect.bottom > pane.bottom + 0.5) return [`${selector} ${rect.top}-${rect.bottom} outside ${pane.top}-${pane.bottom}`];
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.bottom - 2);
      return hit !== null && node.contains(hit) ? [] : [`${selector} bottom edge hits ${hit?.className ?? "nothing"}`];
    });
  });
  expect(problems).toEqual([]);
}

/** The latest command's echo, result and detail are all inside the log's visible rect. */
async function expectLatestResultInView(page: Page): Promise<void> {
  const outside = await page.evaluate(() => {
    const log = document.querySelector(".ut-log")?.getBoundingClientRect();
    const group = [...document.querySelectorAll(".ut-group")].at(-1);
    if (log === undefined || group === undefined) return ["no result"];
    return [".ut-echo", ".ut-applied__summary", ".ut-applied__detail"].flatMap((selector) => {
      const rect = group.querySelector(selector)?.getBoundingClientRect();
      return rect !== undefined && rect.height > 0 && rect.top >= log.top - 0.5 && rect.bottom <= log.bottom + 0.5 ? [] : [selector];
    });
  });
  expect(outside, "rows of the latest result outside the log").toEqual([]);
}

async function runLine(input: Locator, line: string): Promise<void> {
  await input.fill(line);
  await input.press("Enter");
}

for (const width of [390, 1440] as const) {
  test(`composer terminal at ${width}: commands, preview, suggestion, quick fix, history`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await start(page, width);
    await startRms(page);
    const input = await openTerminal(page);
    const log = page.getByRole("log");
    // The help shows beside the log, never inside its live region,
    // and it is the field's description.
    const help = page.locator(".ut-empty");
    await expect(help).toBeVisible();
    await expect(help).toContainText("Type a command, or help to list them.");
    await expect(log).not.toContainText("Type a command");
    await expect(input).toHaveAccessibleDescription(/Type a command, or help to list them\./);
    await expect(page.getByRole("listbox", { name: "Suggestions" }).getByRole("option", { name: "help" })).toBeVisible();
    await screenshot(page, "terminal-empty", width);

    // Typing completes from the registry; Tab takes the suggestion.
    await input.fill("add b");
    await expect(page.getByRole("listbox", { name: "Suggestions" }).getByRole("option", { name: "bass" })).toBeVisible();
    await expect(page.locator(".ut-hint")).toHaveText("add <instrument> [name] · a new track");
    await screenshot(page, "terminal-typing", width);
    await input.press("Tab");
    await expect(input).toHaveValue("add bass ");
    await input.press("Enter");
    await expect(log).toContainText(/Added bass2 on line \d+\./);
    expect((await view(page)).source).toContain("bass2: bass  c2 . . c2 . . c2 .");
    await expect(log.locator(".ut-applied__detail").last()).toHaveText(/playing since bar \d+/, { timeout: NEXT_BAR_MS });

    // The longest hint and a full row of chips: the line stays inside its pane.
    await input.fill("set kick ");
    await expect(page.locator(".ut-hint")).toContainText("set <track> <param> <value>");
    await expectLineInPane(page);
    await input.fill("");

    // tempo 124: the text changes now, the sound on the next bar.
    await runLine(input, "tempo 124");
    expect((await view(page)).source).toMatch(/^tempo 124$/m);
    await expect(log.locator(".ut-applied__detail").last()).toHaveText(/playing since bar \d+/, { timeout: NEXT_BAR_MS });
    expect((await view(page)).tempo).toBe(124);
    await expectLatestResultInView(page);
    await expectLineInPane(page);
    await screenshot(page, "terminal-applied", width);

    // remove ride: a preview first; Cancel leaves the text as it was.
    const before = (await view(page)).source;
    await runLine(input, "remove ride");
    const preview = page.getByRole("group", { name: /Preview · remove ride · 3 lines/ });
    await expect(preview).toBeVisible();
    await expect(preview.getByRole("button", { name: "Apply" })).toBeFocused();
    await expect(preview.locator(".ut-diff__line--added")).toHaveCount(2);
    await expect(preview.locator(".ut-diff__line--removed")).toHaveCount(3);
    await expectPreviewInView(page);
    await screenshot(page, "terminal-preview", width);
    await preview.getByRole("button", { name: "Cancel" }).click();
    await expect(log).toContainText("Cancelled. Nothing changed.");
    expect((await view(page)).source).toBe(before);
    await expect(input).toBeFocused();

    // A typo: the message and the line to try instead.
    await runLine(input, "tmepo 124");
    await expect(log).toContainText('Unknown command "tmepo".');
    const suggestion = log.getByRole("button", { name: "tempo 124" });
    await expect(suggestion).toBeVisible();
    await screenshot(page, "terminal-error", width);
    await suggestion.click();
    await expect(input).toHaveValue("tempo 124");

    // History: Up walks back through what ran.
    await input.fill("");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("tmepo 124");
    await input.press("ArrowUp");
    await expect(input).toHaveValue("remove ride");
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await expect(input).toHaveValue("");

    // clear empties the log and brings the help back, still outside the log.
    await expect(help).toBeHidden();
    await runLine(input, "clear");
    await expect(help).toBeVisible();
    await expect(log).toHaveText("");
    await expect(input).toHaveAccessibleDescription(/Type a command, or help to list them\./);

    // Alt+Down picks another suggestion, Shift+Tab walks back and then leaves: no trap.
    await input.fill("add ");
    const chips = page.getByRole("listbox", { name: "Suggestions" }).getByRole("option");
    expect(await chips.count(), "add offers several instruments").toBeGreaterThan(1);
    await expect(chips.nth(0)).toHaveAttribute("aria-selected", "true");
    await input.press("Alt+ArrowDown");
    await expect(chips.nth(1)).toHaveAttribute("aria-selected", "true");
    await input.press("Shift+Tab");
    await expect(chips.nth(0)).toHaveAttribute("aria-selected", "true");
    await expect(input).toBeFocused();
    await input.press("Shift+Tab");
    await expect(input).not.toBeFocused();
    await input.fill("");

    // The editor's quick fix: "kik" becomes "kick" in one tap, and the text is valid again.
    const broken = (await view(page)).source.replace("kick:  kick", "kick:  kik");
    await page.evaluate((text) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.applyText(text), broken);
    const fix = page.getByRole("button", { name: 'Change to kick' });
    await expect(fix).toBeVisible();
    await screenshot(page, "editor-quick-fix", width);
    await fix.click();
    await expect.poll(async () => (await view(page)).valid).toBe(true);
    expect((await view(page)).source).toContain("kick:  kick  x...");

    const rms = await stopRms(page);
    expect(rms.slices, "500 ms slices sampled").toBeGreaterThan(4);
    expect(rms.quietestSlice, "AnalyserNode RMS in every 500 ms").toBeGreaterThan(RMS_THRESHOLD);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}

// Captures for the contact sheet at the widths the shell lays out differently.
for (const width of [768, 1024] as const) {
  test(`composer terminal captures at ${width}`, async ({ page }) => {
    const errors = collectErrors(page);
    await start(page, width);
    const input = await openTerminal(page);
    await screenshot(page, "terminal-empty", width);
    await input.fill("add b");
    await screenshot(page, "terminal-typing", width);
    await input.fill("set kick ");
    await expectLineInPane(page);
    await runLine(input, "tempo 124");
    await expect(page.getByRole("log").locator(".ut-applied__detail").last()).toHaveText(/playing since bar \d+/, { timeout: NEXT_BAR_MS });
    await expectLatestResultInView(page);
    await screenshot(page, "terminal-applied", width);
    await runLine(input, "remove ride");
    await expect(page.getByRole("group", { name: /Preview · remove ride/ })).toBeVisible();
    await expectPreviewInView(page);
    await screenshot(page, "terminal-preview", width);
    await page.getByRole("button", { name: "Cancel" }).click();
    await runLine(input, "tmepo 124");
    await screenshot(page, "terminal-error", width);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
