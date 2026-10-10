// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Never strand a "|": a phone wraps only before a
// "|" and hangs the rest under the pattern; a desktop does not wrap and scrolls sideways.

import { expect, test } from "@playwright/test";
import { openCode } from "../../support/code-panel-support";
import { collectErrors, screenshot } from "../../../../support/support";

test("phone 390: no line ends with a stranded |, continuation lines start with |", async ({ page }) => {
  await openCode(page, 390);
  const problems = await page.evaluate(() => {
    const out: string[] = [];
    for (const group of document.querySelectorAll(".cm-content .u-mod")) {
      // A group never breaks: one box. Its "|" starts a visual row when it wrapped.
      const rects = [...group.getClientRects()].filter((rect) => rect.width > 0);
      const rows = new Set(rects.map((rect) => Math.round(rect.bottom / 8)));
      if (rows.size !== 1) out.push(`split group: ${group.textContent ?? ""}`);
    }
    for (const line of document.querySelectorAll(".cm-content .cm-line")) {
      const range = document.createRange();
      range.selectNodeContents(line);
      const rows = [...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.bottom / 8));
      if (new Set(rows).size <= 1) continue;
      // Text of each visual row: no row ends with "|"; every row after the first starts with "|" or a song part.
      const text = line.textContent ?? "";
      const byRow = new Map<number, string>();
      for (let at = 0; at < text.length; at += 1) {
        const char = document.createRange();
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        let offset = at;
        let node = walker.nextNode();
        while (node !== null && offset >= (node.textContent ?? "").length) {
          offset -= (node.textContent ?? "").length;
          node = walker.nextNode();
        }
        if (node === null) break;
        char.setStart(node, offset);
        char.setEnd(node, offset + 1);
        const rect = char.getBoundingClientRect();
        if (rect.width === 0) continue;
        const row = Math.round(rect.bottom / 8);
        byRow.set(row, (byRow.get(row) ?? "") + (text[at] ?? ""));
      }
      const rowsText = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([, value]) => value);
      rowsText.forEach((row, index) => {
        if (row.trimEnd().endsWith("|")) out.push(`row ends with |: ${row}`);
        if (index > 0 && !/^\s*(\||[a-z]+ \d+,?)/.test(row)) out.push(`continuation does not start with |: ${row}`);
      });
    }
    return out;
  });
  expect(problems).toEqual([]);
  await screenshot(page, "code-panel-wrap", 390);
});

// Two errors once took the whole editor at 390 (.cm-scroller 0 px) and covered
// Commands. Now the list scrolls and the code keeps three lines.
const BROKEN = ["tempo 132", "kick:  kik  x... x... x... x...", "hat:   ht   ..x. ..x. ..x. ..xx", "sub:   bss  c1 . . c1 . . c1 .", "ride:  hatt x.x. x.x. x.x. x.x."];
for (const count of [2, 4]) {
  test(`phone 390 with ${count} errors: Commands is reachable and the code keeps three lines`, async ({ page }) => {
    await openCode(page, 390, `${BROKEN.slice(0, 1 + count).join("\n")}\n`);
    await expect(page.locator(".untzel-editor__problem").first()).toBeVisible();
    const layout = await page.evaluate(() => {
      const scroller = document.querySelector("#ui-code .cm-scroller")?.getBoundingClientRect().height ?? 0;
      const commands = document.querySelector(".ut-commands-toggle");
      const box = commands?.getBoundingClientRect();
      const hit = box === undefined ? null : document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      const line = Number.parseFloat(getComputedStyle(document.querySelector(".untzel-editor") as Element).getPropertyValue("--untzel-code-line"));
      return { scroller, minimum: 3 * line, isCommandsHit: commands !== null && hit !== null && commands.contains(hit) };
    });
    expect(layout.isCommandsHit, "a tap on Commands lands on it").toBe(true);
    expect(layout.scroller, "the code keeps three lines").toBeGreaterThanOrEqual(layout.minimum);
    await screenshot(page, `code-panel-${count}-errors`, 390);
  });
}

test("desktop 1440: no wrapping, the content scrolls sideways", async ({ page }) => {
  await openCode(page, 1440);
  const layout = await page.evaluate(() => {
    const lines = [...document.querySelectorAll(".cm-content .cm-line")];
    const wrapped = lines.filter((line) => {
      const range = document.createRange();
      range.selectNodeContents(line);
      return new Set([...range.getClientRects()].filter((rect) => rect.width > 0).map((rect) => Math.round(rect.bottom / 8))).size > 1;
    }).length;
    const scroller = document.querySelector("#ui-code .cm-scroller");
    return { wrapped, scrolls: scroller !== null && scroller.scrollWidth > scroller.clientWidth };
  });
  expect(layout).toEqual({ wrapped: 0, scrolls: true });
});
// The Code sheet header in one row of controls: at 390 Close fell
// to a second row and the header took 110 px; the applies line now goes under the title.
const HEADER_BEFORE_PX = 110;
for (const width of [390, 768] as const) {
  test(`sheet ${width}: Close sits on the title's row and the code gains the freed height`, async ({ page }) => {
    const errors = collectErrors(page);
    await openCode(page, width);
    const geometry = await page.evaluate(() => {
      const box = (selector: string): DOMRect => {
        const node = document.querySelector(selector);
        if (node === null) throw new Error(`no ${selector}`);
        return node.getBoundingClientRect();
      };
      const buttons = [...document.querySelectorAll<HTMLElement>("#ui-code .ui-sheet__header button")].filter((node) => node.checkVisibility());
      return {
        title: box("#ui-code .ui-sheet__title").top,
        close: box("#ui-code .ui-sheet__close"),
        header: box("#ui-code .ui-sheet__header"),
        editorTop: box("#ui-code .ui-code__editor").top,
        isCloseLast: buttons.at(-1)?.classList.contains("ui-sheet__close") ?? false,
      };
    });
    expect(Math.abs(geometry.close.top - geometry.title), "Close on the title's row").toBeLessThanOrEqual(4);
    expect(geometry.close.height, "Close keeps 44 px").toBeGreaterThanOrEqual(44);
    expect(geometry.isCloseLast, "Close is the header's last control").toBe(true);
    expect(geometry.header.height, "the header gives back the second row").toBeLessThan(HEADER_BEFORE_PX - 16);
    expect(geometry.editorTop, "the code starts under the header").toBeLessThanOrEqual(geometry.header.bottom + 0.5);
    await screenshot(page, "code-sheet-header", width);
    expect(errors).toEqual([]);
  });
}
