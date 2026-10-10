// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The transport labels next to the lit stage (Code next to Drop and
// the controls hidden). With the controls hidden the stage reaches down to the transport,
// so the measure is the one of tests/skins/booth/timing/topbar-contrast.browser.ts: 48 stress tracks plus
// full-strength shockwaves and sparks, the labels hidden while sampling, and the
// brightest pixel behind each label decides. Shown and hidden, at 390 and 1440. The scene
// keeps the band above the transport dark (the ground ends at 0.55 u); the test checks the
// stage is lit in its middle and still measures every label. In loop mode the Length chip,
// the position ("bar 2 of 4") and the range handle are measured too: the handle is no
// text, so 3:1 for flare. The track controls add the Tempo and Key buttons and, on the
// phone, Undo and Redo with an empty history, their dimmed icon at 3:1.
import { expect, test, type Page } from "@playwright/test";
import { writeMeasurement } from "../support/measure-support";
import { contrast, decodePng, luminance, type Pixels } from "../../../support/png";
import { addStyleSheet } from "../../../support/style-sheet-support";
import { VIEWPORTS, collectErrors, screenshot } from "../../../support/support";

const SAMPLE_MS = 3_000;
/** At least this many screenshots, whatever the machine's load. */
const MIN_FRAMES = 10;
/** Past SAMPLE_MS, sampling goes on until the minimums are met, for at most this long. */
const OVERRUN_MS = 30_000;
const BURST_EVERY_MS = 200;
const PROBES = ["kick", "kick2", "kick3", "kick4", "kick5", "hat", "hat2", "hat3", "hat4", "hat5"];
const TEXT = luminance(255, 255, 255);
const MUTED = luminance(0xaa, 0xa5, 0xa1);
const STAGE = luminance(0x0b, 0x0b, 0x0c);
const FLARE = luminance(0xf6, 0x5d, 0x00);
/** Undo and Redo with an empty history: the dimmed icon of views/undo-redo-buttons.css. */
const DIMMED_ICON = luminance(0x8f, 0x8a, 0x86);

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface Hooks {
  audioTime(): number;
  scheduleLight(cues: readonly unknown[]): void;
}

const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

function brightest(pixels: Pixels, box: Box): number {
  let worst = 0;
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(pixels.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(pixels.height, Math.ceil(box.y + box.height));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * pixels.width + x) * 4;
      const value =
        0.2126 * (LINEAR[pixels.data[index] ?? 0] ?? 0) +
        0.7152 * (LINEAR[pixels.data[index + 1] ?? 0] ?? 0) +
        0.0722 * (LINEAR[pixels.data[index + 2] ?? 0] ?? 0);
      if (value > worst) worst = value;
    }
  }
  return worst;
}

async function burst(page: Page): Promise<void> {
  await page.evaluate((probes) => {
    const t = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
    const at = t.audioTime() + 0.02;
    t.scheduleLight(probes.map((track) => ({
      track,
      audioTime: at,
      duration: 0.2,
      velocity: 1,
      isAccent: true,
      tone: 1,
    })));
  }, PROBES);
}

/** Tight boxes of each label (a Range over the text, the icon's own box), in CSS px. */
async function targets(page: Page, width: number) {
  const boxes = await page.evaluate((isPhone) => {
    const box = (rect: DOMRect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
    const textBox = (selector: string) => {
      const node = document.querySelector(selector);
      if (node === null) throw new Error(`missing ${selector}`);
      const range = document.createRange();
      range.selectNodeContents(node);
      return box(range.getBoundingClientRect());
    };
    const iconBox = (selector: string) => {
      const node = document.querySelector(selector);
      if (node === null) throw new Error(`missing ${selector}`);
      return box(node.getBoundingClientRect());
    };
    const transport = document.querySelector(".ui-transport");
    const stage = document.querySelector(".ui-stage");
    if (transport === null || stage === null) throw new Error("missing the transport");
    return {
      transport: box(transport.getBoundingClientRect()),
      stageTop: stage.getBoundingClientRect().top,
      stageBottom: stage.getBoundingClientRect().bottom,
      code: textBox(".ui-transport__code span"),
      codeIcon: iconBox(".ui-transport__code svg"),
      drop: textBox(".ui-transport__drop span"),
      toggle: iconBox(".ui-transport__toggle svg"),
      line: textBox(isPhone ? ".ui-transport__line--mobile" : ".ui-transport__line--tempo"),
      cpu: textBox(isPhone ? ".ui-transport__sub--mobile" : ".ui-transport__cpu-text"),
      length: textBox(".ui-chip-length__label"),
      position: textBox(".ui-transport__position"),
      ruler: iconBox(".ui-range-ruler__handle"),
      tempo: textBox(".ui-transport__line--tempo .ui-tempo-key__tempo"),
      key: textBox(".ui-transport__line--tempo .ui-tempo-key__key"),
      // Undo and Redo by touch live in the transport below 1200 px.
      undo: isPhone ? iconBox(".ui-transport__history .ui-undo-redo__button:nth-of-type(1) svg") : null,
      redo: isPhone ? iconBox(".ui-transport__history .ui-undo-redo__button:nth-of-type(2) svg") : null,
    };
  }, width < 700);
  return {
    transport: boxes.transport,
    stageTop: boxes.stageTop,
    stageBottom: boxes.stageBottom,
    list: [
      { name: "Code label (text on surface)", box: boxes.code, foreground: TEXT, minimum: 4.5 },
      { name: "Code icon", box: boxes.codeIcon, foreground: TEXT, minimum: 3 },
      { name: "Drop label (text on ember)", box: boxes.drop, foreground: TEXT, minimum: 4.5 },
      { name: "toggle chevron", box: boxes.toggle, foreground: TEXT, minimum: 3 },
      { name: "tempo line (text)", box: boxes.line, foreground: TEXT, minimum: 4.5 },
      { name: "CPU (text-muted)", box: boxes.cpu, foreground: MUTED, minimum: 4.5 },
      { name: "Length chip label (text on raised)", box: boxes.length, foreground: TEXT, minimum: 4.5 },
      { name: "position, bar N of M (text-muted)", box: boxes.position, foreground: MUTED, minimum: 4.5 },
      { name: "range handle (flare, non-text)", box: boxes.ruler, foreground: FLARE, minimum: 3 },
      { name: "Tempo button (text)", box: boxes.tempo, foreground: TEXT, minimum: 4.5 },
      { name: "Key button (text)", box: boxes.key, foreground: TEXT, minimum: 4.5 },
      ...(boxes.undo === null || boxes.redo === null
        ? []
        : [
            { name: "Undo icon, empty history (dimmed, non-text)", box: boxes.undo, foreground: DIMMED_ICON, minimum: 3 },
            { name: "Redo icon, empty history (dimmed, non-text)", box: boxes.redo, foreground: DIMMED_ICON, minimum: 3 },
          ]),
    ],
  };
}

for (const width of [390, 1440] as const) {
  test(`transport labels keep contrast next to the brightest stage at ${width}`, async ({ page }) => {
    test.setTimeout(150_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./?stress=48");
    await page.getByRole("button", { name: "Tap to play" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await page.waitForFunction(() => document.documentElement.dataset["renderer"] !== undefined);

    for (const state of ["shown", "hidden"] as const) {
      if (state === "hidden") {
        await page.locator(".ui-transport__toggle").click();
        await page.waitForFunction(() => document.querySelector(".ui-app")?.getAttribute("data-transition") === null);
      }
      const { transport, stageTop, stageBottom, list } = await targets(page, width);
      // The transport and the 24 px of stage right above it.
      const clip: Box = { x: 0, y: Math.max(0, stageBottom - 24), width: VIEWPORTS[width].width, height: transport.y + transport.height - stageBottom + 24 };
      const removeHiding = await addStyleSheet(
        page,
        // The range line too: what decides is the light behind its handles.
        ".ui-transport :is(button > *, .ui-transport__info, .ui-transport__cpu-text, .ui-transport__range) { visibility: hidden !important; }",
      );
      const worst = new Map(list.map((target) => [target.name, STAGE]));
      const stageEdge: Box = { x: 0, y: 0, width: clip.width, height: 20 };
      let lightAbove = 0;
      let frames = 0;
      const end = Date.now() + SAMPLE_MS;
      const deadline = end + OVERRUN_MS;
      // A count, not a time window: under load each screenshot takes longer, so the
      // window alone sampled 7 or 8 frames. The thresholds stay.
      const isShort = () => frames <= MIN_FRAMES;
      let nextBurst = 0;
      while (Date.now() < end || (isShort() && Date.now() < deadline)) {
        if (Date.now() >= nextBurst) {
          await burst(page);
          nextBurst = Date.now() + BURST_EVERY_MS;
        }
        const pixels = decodePng(await page.screenshot({ clip, scale: "css", animations: "allow" }));
        frames += 1;
        for (const target of list) {
          const local = { ...target.box, x: target.box.x - clip.x, y: target.box.y - clip.y };
          worst.set(target.name, Math.max(worst.get(target.name) ?? 0, brightest(pixels, local)));
        }
        lightAbove = Math.max(lightAbove, brightest(pixels, stageEdge));
      }
      // The ground's light stops at 0.55 u, so the band right above the transport
      // stays dark by design and lightAbove is only recorded. The measure still needs a lit
      // stage: its middle strip, under the same bursts, must carry light.
      const middle: Box = { x: 0, y: Math.round((stageTop + stageBottom) / 2 - 20), width: clip.width, height: 40 };
      let stageLight = 0;
      for (let sample = 0; sample < 5; sample += 1) {
        await burst(page);
        await page.waitForTimeout(60);
        const pixels = decodePng(await page.screenshot({ clip: middle, scale: "css", animations: "allow" }));
        stageLight = Math.max(stageLight, brightest(pixels, { x: 0, y: 0, width: middle.width, height: middle.height }));
      }
      await removeHiding();
      await burst(page);
      await page.waitForTimeout(150);
      await screenshot(page, `transport-bright-${state}`, width);

      const results = list.map((target) => {
        const background = worst.get(target.name) ?? 1;
        return {
          name: target.name,
          box: target.box,
          brightestBackground: Number(background.toFixed(4)),
          contrast: Number(contrast(target.foreground, background).toFixed(2)),
          minimum: target.minimum,
        };
      });
      writeMeasurement(`transport-contrast-${width}-${state}`, {
        date: new Date().toISOString(),
        viewport: VIEWPORTS[width],
        state,
        stressTracks: 48,
        renderer: await page.evaluate(() => document.documentElement.dataset["renderer"]),
        frames,
        lightAboveTransport: Number(lightAbove.toFixed(4)),
        stageMiddleLight: Number(stageLight.toFixed(4)),
        results,
      });
      expect(frames, "screenshots sampled").toBeGreaterThan(MIN_FRAMES);
      expect(stageLight, `the stage is lit while the transport is measured (${state})`).toBeGreaterThan(STAGE * 2);
      for (const result of results) {
        expect(result.contrast, `${result.name}, controls ${state}`).toBeGreaterThanOrEqual(result.minimum);
      }
    }
    expect(errors).toEqual([]);
  });
}
