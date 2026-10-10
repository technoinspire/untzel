// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The chrome line of the scene (TOP_CHROME_KEEP_OUT_Y) against the real top bar: on the
// 1440 × 900 and 390 × 844 stages the lowest visible part of the bar
// (logo, title, attribution, Share, Export; the bar's own box is transparent padding), in
// the composition units of fitScene and sceneSquare, sits at or above y = −0.78 u, so the
// band the scene keeps dark on the page is the band the bar's content covers.
import { TOP_CHROME_KEEP_OUT_Y } from "@untzel/scene";
import { fitScene, sceneSquare } from "@untzel/light/offline";
import { expect, test } from "@playwright/test";
import { startEngine } from "../../support/share-support";
import { VIEWPORTS, collectErrors } from "../../../../support/support";
for (const width of [1440, 390] as const) {
  test(`at ${VIEWPORTS[width].width} × ${VIEWPORTS[width].height} the top bar's lower edge maps above the chrome line`, async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await startEngine(page);
    const rects = await page.evaluate(() => {
      const box = (selector: string) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect === undefined ? null : { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      };
      const parts = [...document.querySelectorAll(".ui-topbar *")].filter((node) => node.children.length === 0).map((node) => node.getBoundingClientRect());
      // Visually hidden labels are 1 × 1: not something the eye sees over the light.
      const visible = parts.filter((rect) => rect.width > 2 && rect.height > 2);
      const bottom = Math.max(...visible.map((rect) => rect.bottom));
      return { stage: box("canvas.untzel-stage"), bar: visible.length === 0 ? null : { bottom } };
    });
    if (rects.stage === null || rects.bar === null) throw new Error("no stage or no top bar");
    const { unit } = sceneSquare(fitScene({ width: rects.stage.width, height: rects.stage.height }));
    const barBottom = (rects.bar.bottom - rects.stage.top - rects.stage.height / 2) / (unit * rects.stage.height);
    expect(barBottom, "the bar's lowest visible part, in u").toBeLessThanOrEqual(TOP_CHROME_KEEP_OUT_Y);
    expect(barBottom, "the bar is over the stage's top band").toBeGreaterThan(TOP_CHROME_KEEP_OUT_Y - 0.25);
    expect(errors).toEqual([]);
  });
}
