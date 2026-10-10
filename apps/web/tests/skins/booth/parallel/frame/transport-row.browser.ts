// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// With the 480 px side panel open, the Length chip pushed Drop
// and the hide toggle onto a second row, away from Code (1440 with Add track, 1280 with
// any panel). From 1280 the desktop transport is one row in every state of
// desktop-length.svg: Code next to Drop, the toggle at the end, nothing wrapped or cut.
// Only from 1200 to 1243 with a panel open in loop mode is it two rows, by design: the
// Length chip, Code and Drop together at the right edge, under
// the toggle. Song mode has no chip and stays one row there too.
import { expect, test, type Page } from "@playwright/test";
import { startSession } from "../../support/session-support";
import { writeMeasurement } from "../../support/measure-support";
import { collectErrors, screenshot } from "../../../../support/support";
/** Song mode enters on the next 4-bar phrase: 7.3 s at 132 BPM, plus margin. */
const NEXT_PHRASE_MS = 10_000;
/** One row of 44 px targets, with room for a focus ring. */
const ONE_ROW_PX = 56;
/** Two rows of 44 px and the 8 px between them, with the same room. */
const TWO_ROWS_PX = 108;
interface Panel {
  readonly name: string;
  readonly sheet: string;
  readonly open: (page: Page) => Promise<void>;
}
const TRACK: Panel = { name: "Track", sheet: "#ui-detail", open: (page) => page.locator(".ui-tracktable .ui-table__name").first().click() };
const ADD_TRACK: Panel = { name: "Add track", sheet: "#ui-library", open: (page) => page.locator(".ui-tracktable").getByRole("button", { name: "Add track" }).click() };
const CODE: Panel = { name: "Code", sheet: "#ui-code", open: (page) => page.locator(".ui-transport__code").click() };
const PART: Panel = {
  name: "Part",
  sheet: "#ui-part",
  open: (page) => page.getByRole("list", { name: "Parts of the song" }).getByRole("button").first().click(),
};
interface Box {
  readonly top: number;
  readonly right: number;
}
interface Row {
  readonly height: number;
  /** Boxes that overlap, or text cut short ("132 BPM · c m…"). */
  readonly collisions: string[];
  readonly play: Box;
  readonly toggle: Box;
  readonly code: Box;
  readonly drop: Box;
  /** Null in song mode, where the chip is hidden. */
  readonly length: Box | null;
}
async function rowOf(page: Page): Promise<Row> {
  return page.locator(".ui-transport").evaluate((transport) => {
    const visible = (node: HTMLElement): boolean => node.offsetParent !== null && getComputedStyle(node).display !== "contents";
    const children = [...transport.querySelectorAll<HTMLElement>(":scope > *, .ui-transport__actions > *")].filter(visible);
    const collisions: string[] = [];
    children.forEach((node, at) => {
      const a = node.getBoundingClientRect();
      for (const other of children.slice(at + 1)) {
        if (node.contains(other) || other.contains(node)) continue;
        const b = other.getBoundingClientRect();
        const meets = a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
        if (meets) collisions.push(`${node.className} overlaps ${other.className}`);
      }
    });
    for (const node of [...children, ...transport.querySelectorAll<HTMLElement>(".ui-transport__info > *")]) {
      if (visible(node) && node.scrollWidth > node.clientWidth + 1) collisions.push(`${node.className} cut ${node.scrollWidth - node.clientWidth} px`);
    }
    const box = (selector: string): { top: number; right: number } | null => {
      const node = transport.querySelector<HTMLElement>(selector);
      if (node === null || !visible(node)) return null;
      const rect = node.getBoundingClientRect();
      return { top: Math.round(rect.top), right: Math.round(rect.right) };
    };
    const none = { top: -1, right: -1 };
    return {
      // The row's own height: the play range takes a line of its own under it.
      height: Math.round(
        Math.max(...children.filter((node) => !node.classList.contains("ui-transport__range")).map((node) => node.getBoundingClientRect().bottom)) -
          transport.getBoundingClientRect().top,
      ),
      collisions,
      play: box(".ui-transport__play") ?? none,
      toggle: box(".ui-transport__toggle") ?? none,
      code: box(".ui-transport__code") ?? none,
      drop: box(".ui-transport__drop") ?? none,
      length: box(".ui-transport__length"),
    };
  });
}
async function expectRow(page: Page, state: string, rows: 1 | 2): Promise<void> {
  const row = await rowOf(page);
  expect(row.collisions, `${state}: collisions`).toEqual([]);
  expect(row.drop.top, `${state}: Code and Drop share a top`).toBe(row.code.top);
  if (row.length !== null) expect(row.length.top, `${state}: the Length chip sits with Code`).toBe(row.code.top);
  expect(row.toggle.top, `${state}: the toggle sits with play`).toBe(row.play.top);
  if (rows === 1) {
    expect(row.height, `${state}: one row`).toBeLessThanOrEqual(ONE_ROW_PX);
    expect(row.code.top, `${state}: Code on the play row`).toBe(row.play.top);
  } else {
    expect(row.height, `${state}: two rows`).toBeLessThanOrEqual(TWO_ROWS_PX);
    expect(row.drop.right, `${state}: Drop at the right edge, under the toggle`).toBe(row.toggle.right);
  }
}
async function expectEachPanel(page: Page, state: string, panels: readonly Panel[], rowsWithPanel: 1 | 2): Promise<void> {
  await expectRow(page, `${state}, no panel`, 1);
  for (const panel of panels) {
    await panel.open(page);
    await expect(page.locator(panel.sheet)).toBeVisible();
    await expectRow(page, `${state}, ${panel.name} open`, rowsWithPanel);
    await page.keyboard.press("Escape");
    await expect(page.locator(panel.sheet)).toBeHidden();
  }
}
/**
 * The 44 px targets of "124 BPM · c minor", measured with elementFromPoint, never
 * estimated: each target is its button's
 * ::before (down from line 2 below 1200 px, up over the stage on the desktop).
 */
interface TargetReport {
  readonly name: string;
  readonly box: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** What elementFromPoint returns at the centre of the target. */
  readonly centre: string;
  /** Either bottom corner, 1 px inside, returns this. */
  readonly corners: readonly string[];
  /** Other controls of the page the target overlaps. */
  readonly covers: readonly string[];
  /**
   * Passive meters under the transparent target (the song progress below 1200 px): design
   * A puts the target over the ruler's row, which the song meter shares; neither is a
   * control, so a tap there has nothing else to reach. Recorded, not refused.
   */
  readonly meters: readonly string[];
}
interface TargetGeometry {
  readonly targets: readonly TargetReport[];
  /** Points along line 1 (the position line on the desktop) that return a tempo or key button. */
  readonly lineHits: readonly string[];
  /** The " · " between the two buttons is no part of either. */
  readonly dot: string;
}
async function targetGeometry(page: Page): Promise<TargetGeometry> {
  return page.evaluate(() => {
    const transport = document.querySelector<HTMLElement>(".ui-transport");
    if (transport === null) throw new Error("no transport");
    const buttons = [...transport.querySelectorAll<HTMLButtonElement>(".ui-tempo-key__button")];
    const describe = (node: Element | null): string => {
      if (node === null) return "nothing";
      const owner = node.closest("button, [role='slider'], [role='progressbar'], a, input, select, textarea") ?? node;
      return `${owner.tagName.toLowerCase()}.${String(owner.className).trim().split(/\s+/).join(".")}`;
    };
    const at = (x: number, y: number): string => describe(document.elementFromPoint(x, y));
    const shown = (node: HTMLElement): boolean => !buttons.includes(node as HTMLButtonElement) && node.offsetParent !== null && node.getBoundingClientRect().width > 0;
    const controls = [...document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [role='slider'], [tabindex='0']")].filter(shown);
    const meters = [...document.querySelectorAll<HTMLElement>("[role='progressbar']")].filter(shown);
    const targets = buttons.map((button) => {
      const own = button.getBoundingClientRect();
      const pseudo = getComputedStyle(button, "::before");
      const pseudoLeft = own.left + Number.parseFloat(pseudo.left);
      const pseudoTop = own.top + Number.parseFloat(pseudo.top);
      const left = Math.min(own.left, pseudoLeft);
      const top = Math.min(own.top, pseudoTop);
      const right = Math.max(own.right, pseudoLeft + Number.parseFloat(pseudo.width));
      const bottom = Math.max(own.bottom, pseudoTop + Number.parseFloat(pseudo.height));
      const overlaps = (node: HTMLElement): boolean => {
        const rect = node.getBoundingClientRect();
        return rect.left < right - 0.5 && left < rect.right - 0.5 && rect.top < bottom - 0.5 && top < rect.bottom - 0.5;
      };
      return {
        name: button.getAttribute("aria-label") ?? button.textContent ?? "",
        box: { left, top, width: right - left, height: bottom - top },
        centre: at((left + right) / 2, (top + bottom) / 2),
        corners: [at(left + 1, bottom - 1), at(right - 1, bottom - 1)],
        covers: controls.filter(overlaps).map(describe),
        meters: meters.filter(overlaps).map(describe),
      };
    });
    const isDesktop = window.innerWidth >= 1200;
    const line = transport.querySelector<HTMLElement>(isDesktop ? ".ui-transport__position" : ".ui-transport__line--mobile");
    const lineHits: string[] = [];
    if (line !== null) {
      const range = document.createRange();
      range.selectNodeContents(line);
      const rect = line.getBoundingClientRect();
      for (const fraction of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        for (const y of [rect.top + 1, rect.top + rect.height / 2, rect.bottom - 1]) {
          const hit = document.elementFromPoint(rect.left + rect.width * fraction, y);
          if (hit !== null && buttons.some((button) => button.contains(hit))) lineHits.push(`${Math.round(fraction * 100)} % at y ${Math.round(y)}: ${describe(hit)}`);
        }
      }
    }
    const dotNode = transport.querySelector(".ui-tempo-key__dot");
    const dotRect = dotNode?.getBoundingClientRect();
    const dot = dotRect === undefined ? "missing" : at(dotRect.left + dotRect.width / 2, dotRect.top + dotRect.height / 2);
    return { targets, lineHits, dot };
  });
}
async function expectTargets(page: Page, state: string): Promise<TargetGeometry> {
  const geometry = await targetGeometry(page);
  expect(geometry.targets, `${state}: two targets`).toHaveLength(2);
  for (const target of geometry.targets) {
    const label = `${state}, ${target.name}`;
    expect(target.box.height, `${label}: 44 px tall`).toBeGreaterThanOrEqual(44);
    expect(target.box.width, `${label}: 44 px wide`).toBeGreaterThanOrEqual(44);
    expect(target.centre, `${label}: the centre is the button`).toContain("ui-tempo-key__button");
    for (const corner of target.corners) expect(corner, `${label}: a bottom corner is the button, never a chip`).toContain("ui-tempo-key__button");
    expect(target.covers, `${label}: covers no other control`).toEqual([]);
  }
  expect(geometry.lineHits, `${state}: line 1 is never a tempo or key target`).toEqual([]);
  if ((page.viewportSize()?.width ?? 0) < 1200) {
    // Undo and Redo by touch sit in the transport: 44 px, nothing overlapped or cut.
    const history = page.locator(".ui-transport__history");
    for (const name of ["Undo", "Redo"]) {
      const box = await history.getByRole("button", { name, exact: true }).boundingBox();
      expect(box?.width, `${state}: ${name} 44 px wide`).toBeGreaterThanOrEqual(44);
      expect(box?.height, `${state}: ${name} 44 px tall`).toBeGreaterThanOrEqual(44);
    }
    expect((await rowOf(page)).collisions, `${state}: collisions`).toEqual([]);
  }
  expect(geometry.dot, `${state}: the dot between them is no target`).not.toContain("ui-tempo-key__button");
  return geometry;
}
const TARGET_SIZES = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;
for (const { width, height } of TARGET_SIZES) {
  test(`the tempo and key targets are 44 px and cover nothing else at ${width}, loop and song`, async ({ page }) => {
    test.setTimeout(60_000);
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height });
    await startSession(page);
    const loop = await expectTargets(page, `loop at ${width}`);
    if (width < 1200) {
      await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
      await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
    } else {
      await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
    }
    await expect(page.locator(".ui-transport")).toHaveAttribute("data-mode", "song", { timeout: NEXT_PHRASE_MS });
    const song = await expectTargets(page, `song at ${width}`);
    const summary = (geometry: TargetGeometry) => geometry.targets.map((target) => ({ name: target.name, box: target.box, meters: target.meters }));
    writeMeasurement(`transport-targets-${width}`, { date: new Date().toISOString(), viewport: { width, height }, loop: summary(loop), song: summary(song) });
    expect(errors).toEqual([]);
  });
}
const SIZES = [
  { width: 1200, height: 800, loopRowsWithPanel: 2 },
  { width: 1280, height: 800, loopRowsWithPanel: 1 },
  { width: 1440, height: 900, loopRowsWithPanel: 1 },
] as const;
for (const { width, height, loopRowsWithPanel } of SIZES) {
  test(`the desktop transport keeps Code next to Drop with any panel open at ${width}, loop and song`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = collectErrors(page);
    await page.setViewportSize({ width, height });
    await startSession(page);
    // The widest chip label: "Length 16 bars".
    await page.getByRole("button", { name: "Loop length 4 bars" }).click();
    await page.getByRole("dialog", { name: /length/i }).getByRole("button", { name: "16 bars", exact: true }).click();
    await expect(page.getByRole("button", { name: "Loop length 16 bars" })).toBeVisible();
    await expectEachPanel(page, `loop at ${width}`, [TRACK, ADD_TRACK, CODE], loopRowsWithPanel);
    if (width === 1440) {
      await ADD_TRACK.open(page);
      await screenshot(page, "transport-add-track", 1440);
      await page.keyboard.press("Escape");
    }
    await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
    await expect(page.getByRole("list", { name: "Parts of the song" })).toBeVisible({ timeout: NEXT_PHRASE_MS });
    await expectEachPanel(page, `song at ${width}`, [PART, TRACK, ADD_TRACK, CODE], 1);
    expect(errors).toEqual([]);
  });
}
