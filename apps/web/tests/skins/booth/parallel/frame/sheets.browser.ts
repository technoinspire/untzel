// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Every sheet and the desktop side panel close by each of their close methods, on the
// real session, and hand focus back to the control that opened them. The library's ×
// once did nothing on desktop: the panel's × cleared the panel and left the overlay.

import { expect, test, type Locator, type Page } from "@playwright/test";
import { VIEWPORTS, collectErrors } from "../../../../support/support";

type Method = "close button" | "Escape" | "backdrop";

interface SheetCase {
  readonly name: string;
  readonly sheet: string;
  /** The control that opens the layer; focus must come back to it. */
  readonly opener: (page: Page) => Locator;
  /** Extra steps after clicking the opener (desktop Code is a tab of the open panel). */
  readonly then?: (page: Page) => Promise<void>;
  readonly methods: readonly Method[];
}

/** The project menu's button: what every sheet opened from the menu gives the focus back to. */
const menuButton = (page: Page): Locator => page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true });
const fromMenu = (item: RegExp) => async (page: Page): Promise<void> => page.getByRole("menuitem", { name: item }).click();
/** The sheets the menu opens: Share link…, Open project…, Keyboard shortcuts, About and licence. */
const MENU_SHEETS: readonly SheetCase[] = [
  { name: "Share", sheet: "#ui-share", opener: menuButton, then: fromMenu(/^Share link/), methods: ["close button", "Escape"] },
  { name: "Projects", sheet: "#ui-projects", opener: menuButton, then: fromMenu(/^Open project/), methods: ["close button", "Escape"] },
  { name: "Keyboard shortcuts", sheet: "#ui-shortcuts", opener: menuButton, then: fromMenu(/^Keyboard shortcuts/), methods: ["close button", "Escape"] },
  { name: "About", sheet: "#ui-about", opener: menuButton, then: fromMenu(/^About and licence/), methods: ["close button", "Escape"] },
];
const MOBILE: readonly SheetCase[] = [
  {
    name: "Add track",
    sheet: "#ui-library",
    opener: (page) => page.locator(".ui-tracks").getByRole("button", { name: "Add track" }),
    methods: ["close button", "Escape", "backdrop"],
  },
  {
    name: "track detail",
    sheet: "#ui-detail",
    opener: (page) => page.getByRole("button", { name: "Adjust kick", exact: true }),
    methods: ["close button", "Escape"],
  },
  {
    name: "Code",
    sheet: "#ui-code",
    opener: (page) => page.locator(".ui-transport__code"),
    methods: ["close button", "Escape"],
  },
  ...MENU_SHEETS,
  {
    name: "Menu",
    sheet: "#ui-menu-sheet",
    opener: menuButton,
    methods: ["close button", "Escape"],
  },
  {
    name: "Export",
    sheet: "#ui-export",
    opener: (page) => page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }),
    methods: ["close button", "Escape"],
  },
];

const DESKTOP: readonly SheetCase[] = [
  {
    name: "Add track",
    sheet: "#ui-library",
    opener: (page) => page.locator(".ui-tracktable").getByRole("button", { name: "Add track" }),
    methods: ["close button", "Escape"],
  },
  {
    name: "track detail",
    sheet: "#ui-detail",
    opener: (page) => page.locator(".ui-tracktable .ui-table__name").first(),
    methods: ["close button", "Escape"],
  },
  {
    name: "Code",
    sheet: "#ui-code",
    opener: (page) => page.locator(".ui-transport__code"),
    methods: ["close button", "Escape"],
  },
  ...MENU_SHEETS,
  {
    name: "Menu",
    sheet: ".ui-menu-popover",
    opener: menuButton,
    methods: ["Escape"],
  },
  {
    name: "Export",
    sheet: "#ui-export",
    opener: (page) => page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }),
    methods: ["close button", "Escape"],
  },
];

async function startEngine(page: Page): Promise<void> {
  await page.goto("./");
  await page.getByRole("button", { name: "Tap to play" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
}

async function closeBy(page: Page, method: Method): Promise<void> {
  switch (method) {
    case "close button": {
      const close = page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true });
      await expect(close).toHaveCount(1);
      await close.click();
      return;
    }
    case "Escape":
      await page.keyboard.press("Escape");
      return;
    case "backdrop":
      // Between the top bar and the sheet: only the backdrop is there (the click checks it).
      await page.locator(".ui-backdrop").click({ position: { x: 195, y: 110 } });
  }
}

for (const [width, cases] of [[390, MOBILE], [1440, DESKTOP]] as const) {
  for (const sheetCase of cases) {
    test(`${sheetCase.name} closes by ${sheetCase.methods.join(", ")} at ${width}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.setViewportSize(VIEWPORTS[width]);
      await startEngine(page);
      const app = page.locator(".ui-app");
      const sheet = page.locator(sheetCase.sheet);
      const panel = page.locator("aside.ui-panel");
      for (const method of sheetCase.methods) {
        const opener = sheetCase.opener(page);
        await opener.click();
        await sheetCase.then?.(page);
        await expect(sheet, `${sheetCase.name} opens`).toBeVisible();
        await closeBy(page, method);
        await expect(sheet, `${sheetCase.name} stays open after ${method}`).toBeHidden({ timeout: 2_000 });
        await expect(app).toHaveAttribute("data-overlay", "none");
        await expect(app).toHaveAttribute("data-panel", "none");
        if (width === 1440) await expect(panel, "the side panel closes with its content").toBeHidden();
        else await expect(app).toHaveAttribute("data-tab", "tracks");
        await expect(opener, `focus returns to the opener after ${method}`).toBeFocused();
      }
      expect(errors).toEqual([]);
    });
  }
}

test("a track added from the library closes back to Add track", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startEngine(page);
  const add = page.locator(".ui-tracks").getByRole("button", { name: "Add track" });
  await add.click();
  await page.locator("#ui-library").getByRole("combobox").fill("hat");
  await page.locator("#ui-library").getByRole("button", { name: "Add hat", exact: true }).click();
  const detail = page.locator("#ui-detail");
  await expect(detail).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden({ timeout: 2_000 });
  await expect(add).toBeFocused();
});
