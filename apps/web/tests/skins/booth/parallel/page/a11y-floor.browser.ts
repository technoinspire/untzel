// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The accessibility floor of the app, measured on the real session as a
// regression net. For every state of the plan at 390,
// 768, 1024 and 1440:
//   - every target in reach is 44 × 44, or a touch 21.5 px from its centre lands on it
//     (Tempo and Key grow their area with a pseudo-element);
//   - every inert label is at least 4.5:1 over the first opaque background behind it, and
//     the glyph of an inert control with no visible text (its strokes and fills) 3:1;
//   - every Tab stop draws a ring: its outline or box-shadow (or a close ancestor's)
//     differs from rest;
//   - headings never skip a level.
// And: with reduced motion nothing animates, and a code error and a broken file reach
// the polite status region. Measured with getBoundingClientRect, elementFromPoint and
// getComputedStyle; the WCAG formula, never an estimate.
import { expect, test, type Page } from "@playwright/test";
import { writeMeasurement } from "../../support/measure-support";
import { lineOf, startSession } from "../../support/session-support";
import { VIEWPORTS, collectErrors, type ViewportWidth } from "../../../../support/support";

const WIDTHS: readonly ViewportWidth[] = [390, 768, 1024, 1440];
/** Song mode enters on the next 4-bar phrase: 7.3 s at 132 BPM, plus margin. */
const NEXT_PHRASE_MS = 10_000;
/** Two unknown instruments: two blocks in the editor's error list. */
const TWO_ERRORS = "tempo 132\nkick:  kik  x... x... x... x...\nhat:   ht   ..x. ..x. ..x. ..xx\n";

interface Hooks {
  applyText(text: string): void;
}

const isDesktop = (width: ViewportWidth): boolean => width >= 1200;
const menuItem = async (page: Page, item: RegExp): Promise<void> => {
  await page.locator(".ui-topbar").getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
};

async function openDetail(page: Page, track: string, width: ViewportWidth): Promise<void> {
  if (isDesktop(width)) await page.locator(".ui-tracktable .ui-table__name").filter({ hasText: new RegExp(`^${track}`) }).click();
  else await page.getByRole("button", { name: `Adjust ${track}`, exact: true }).click();
  await expect(page.locator("#ui-detail .ui-sheet__title")).toHaveText(track);
}

async function songMode(page: Page, width: ViewportWidth): Promise<void> {
  if (isDesktop(width)) {
    await page.locator(".ui-transport__modes").getByRole("button", { name: "Song" }).click();
  } else {
    await page.locator(".ui-tabs").getByRole("button", { name: "Song" }).click();
    await page.locator(".ui-song__modes").getByRole("button", { name: "Song" }).click();
  }
  await expect(page.getByRole("list", { name: "Parts of the song" })).toBeVisible({ timeout: NEXT_PHRASE_MS });
}

interface FloorState {
  readonly name: string;
  readonly open: (page: Page, width: ViewportWidth) => Promise<void>;
}

const STATES: readonly FloorState[] = [
  {
    name: "waiting",
    open: async (page) => {
      await page.goto("./?template=phase1-onboard");
      await expect(page.getByRole("button", { name: "Tap to play" })).toBeVisible();
    },
  },
  { name: "playing", open: startSession },
  { name: "drum detail", open: async (page, width) => (await startSession(page), await openDetail(page, "kick", width)) },
  {
    name: "note picker",
    open: async (page, width) => {
      await startSession(page);
      await openDetail(page, "bass", width);
      const detail = page.locator("#ui-detail");
      await detail.locator(".ui-sheet__body").evaluate((body) => body.scrollTo({ top: 0 }));
      await detail.getByRole("table", { name: "Steps, bar 1" }).getByRole("button", { name: "Step 2, c2" }).dispatchEvent("click");
      await expect(detail.locator(".ui-picker")).toBeVisible();
    },
  },
  {
    name: "library",
    open: async (page, width) => {
      await startSession(page);
      await page.locator(isDesktop(width) ? ".ui-tracktable" : ".ui-tracks").getByRole("button", { name: "Add track" }).click();
      await expect(page.locator("#ui-library")).toBeVisible();
    },
  },
  {
    name: "export with a stretch",
    open: async (page) => {
      await startSession(page);
      await page.getByRole("button", { name: /^Loop length/ }).click();
      await page.getByRole("dialog", { name: /length/i }).getByRole("button", { name: "8 bars", exact: true }).click();
      const start = page.locator(".ui-transport").getByRole("group", { name: "Play range" }).getByRole("slider", { name: "Range start" });
      await expect(start).toHaveAttribute("aria-valuemax", "8", { timeout: 5_000 });
      await start.focus();
      for (let bar = 1; bar < 5; bar += 1) await start.press("ArrowRight");
      await page.locator(".ui-topbar").getByRole("button", { name: "Export", exact: true }).click();
      await expect(page.locator("#ui-export .ui-export__selected")).toHaveText("Bars 5–8");
    },
  },
  { name: "Share", open: async (page) => (await startSession(page), await menuItem(page, /^Share link/), await expect(page.locator("#ui-share").getByLabel("Link")).toHaveValue(/#v1\./)) },
  { name: "Projects", open: async (page) => (await startSession(page), await menuItem(page, /^Open project/), await expect(page.locator("#ui-projects")).toBeVisible()) },
  { name: "About", open: async (page) => (await startSession(page), await menuItem(page, /^About and licence/), await expect(page.locator("#ui-about")).toBeVisible()) },
  { name: "tempo", open: async (page) => (await startSession(page), await page.locator(".ui-tempo-key__tempo").filter({ visible: true }).click(), await expect(page.locator("#ui-tempo")).toBeVisible()) },
  { name: "key", open: async (page) => (await startSession(page), await page.locator(".ui-tempo-key__key").filter({ visible: true }).click(), await expect(page.locator("#ui-key")).toBeVisible()) },
  { name: "length", open: async (page) => (await startSession(page), await page.locator(".ui-transport__length").click(), await expect(page.locator("#ui-length")).toBeVisible()) },
  {
    name: "Code with Commands and two errors",
    open: async (page) => {
      await startSession(page);
      await page.evaluate((text) => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.applyText(text), TWO_ERRORS);
      await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
      await expect(page.locator(".untzel-editor__problem")).toHaveCount(2);
      await page.getByRole("button", { name: "Commands" }).click();
      await expect(page.getByRole("combobox", { name: "Command" })).toBeVisible();
    },
  },
  {
    // At 1440 the side panel shows its Track and Part tabs here.
    name: "song with a part open",
    open: async (page, width) => {
      await startSession(page);
      await songMode(page, width);
      await page.getByRole("list", { name: "Parts of the song" }).getByRole("button").first().click();
      await expect(page.locator("#ui-part")).toBeVisible();
    },
  },
];

interface FloorReport {
  readonly targets: readonly string[];
  readonly inertContrast: readonly string[];
  /** Inert controls with no visible text whose glyph is under 3:1. */
  readonly inertIcons: readonly string[];
  /** Every inert icon-only control measured, with its glyph's ratio. */
  readonly iconControls: readonly string[];
  readonly headings: readonly string[];
  /** How many of each were measured, so an empty report is not an empty page. */
  readonly counts: { readonly targets: number; readonly inertTexts: number; readonly inertIcons: number; readonly headings: number };
  /** The smallest touch reach and the lowest inert contrasts measured, for the report. */
  readonly lowest: { readonly reach: number | null; readonly inertContrast: number | null; readonly inertIconContrast: number | null };
}

/** Targets, inert contrast and headings of what shows now. Runs in the page. */
function measureFloor(): FloorReport {
  const TARGETS = "button, a[href], input:not([type=hidden]), select, textarea, [role=slider], [role=switch], [role=tab], [role=menuitem], [role=menuitemcheckbox], [role=menuitemradio], [role=option], [role=radio], [role=separator][tabindex]";
  const MIN = 44 - 0.5;
  /** The farthest a touch is probed from the centre, each way, in 1 px steps. */
  const PROBE = 44;
  const describe = (node: Element): string => {
    const name = node.getAttribute("aria-label") ?? node.textContent?.trim().replace(/\s+/g, " ").slice(0, 32) ?? "";
    return `${node.tagName.toLowerCase()}.${String(node.className).split(" ")[0] ?? ""} "${name}"`;
  };
  const hits = (node: Element, x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false;
    const hit = document.elementFromPoint(x, y);
    return hit !== null && (hit === node || node.contains(hit));
  };
  /**
   * The touch area along one axis through the centre: the run of points that land on the
   * target, a pseudo-element's area included (Tempo and Key grow downwards under 1200).
   */
  const reachAlong = (node: Element, x: number, y: number, dx: number, dy: number): number => {
    let span = 1;
    for (const sign of [-1, 1]) {
      for (let step = 1; step <= PROBE && hits(node, x + sign * step * dx, y + sign * step * dy); step += 1) span += 1;
    }
    return span;
  };
  const layerOf = (node: Element): Element | null => node.closest(".ui-sheet, .ui-menu-popover, .ui-topbar, .ui-transport, .ui-tabs");
  const isMeasurable = (node: Element): boolean => {
    const box = node.getBoundingClientRect();
    return box.width > 2 && box.height > 2 && node.closest("[inert], [aria-hidden='true']") === null
      && node.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  };

  /** In reach: its centre lands on it, after scrolling it into view if its own layer hides it. */
  const inReach = (node: Element): "yes" | "covered by another layer" | "covered in its own layer" => {
    let box = node.getBoundingClientRect();
    const centre = (): [number, number] => [box.left + box.width / 2, box.top + box.height / 2];
    const [x, y] = centre();
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) {
      node.scrollIntoView({ block: "center", inline: "center" });
      box = node.getBoundingClientRect();
    }
    if (hits(node, ...centre())) return "yes";
    const cover = document.elementFromPoint(...centre());
    const layer = layerOf(node);
    if (cover === null || layer === null || !layer.contains(cover)) return "covered by another layer";
    node.scrollIntoView({ block: "center", inline: "nearest" });
    box = node.getBoundingClientRect();
    return hits(node, ...centre()) ? "yes" : "covered in its own layer";
  };

  const targets: string[] = [];
  // What is in reach as drawn goes first: scrolling one target into view can move another.
  const isInReachAsDrawn = (node: Element): boolean => {
    const box = node.getBoundingClientRect();
    return hits(node, box.left + box.width / 2, box.top + box.height / 2);
  };
  const all = [...document.querySelectorAll(TARGETS)].filter(isMeasurable);
  const candidates = [...all.filter(isInReachAsDrawn), ...all.filter((node) => !isInReachAsDrawn(node))];
  let measured = 0;
  let lowestReach = Infinity;
  for (const node of candidates) {
    const reach = inReach(node);
    if (reach === "covered by another layer") continue;
    measured += 1;
    if (reach === "covered in its own layer") {
      targets.push(`${describe(node)} is covered inside its own layer`);
      continue;
    }
    const box = node.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const width = box.width >= MIN ? box.width : reachAlong(node, x, y, 1, 0);
    const height = box.height >= MIN ? box.height : reachAlong(node, x, y, 0, 1);
    lowestReach = Math.min(lowestReach, width, height);
    if (width < MIN || height < MIN) targets.push(`${describe(node)} ${box.width.toFixed(1)}×${box.height.toFixed(1)}, reach ${width}×${height}`);
  }

  type Rgba = { r: number; g: number; b: number; a: number };
  const parse = (value: string): Rgba | null => {
    const rgb = /^rgba?\(([^)]+)\)$/.exec(value);
    const srgb = /^color\(srgb ([^)]+)\)$/.exec(value);
    const parts = (rgb?.[1] ?? srgb?.[1] ?? "").split(/[\s,/]+/).filter(Boolean).map(Number);
    if (parts.length < 3) return null;
    const scale = srgb === null ? 1 : 255;
    return { r: (parts[0] ?? 0) * scale, g: (parts[1] ?? 0) * scale, b: (parts[2] ?? 0) * scale, a: parts[3] ?? 1 };
  };
  const over = (top: Rgba, bottom: Rgba): Rgba => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const luminance = ({ r, g, b }: Rgba): number => {
    const channel = (value: number): number => {
      const unit = value / 255;
      return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  /**
   * A paint (the text colour, or an icon shape's stroke or fill) over the first opaque
   * background behind it; null over the stage or an image.
   */
  const contrastOf = (node: Element, paint: string = getComputedStyle(node).color, paintOpacity = 1): number | null => {
    const layers: Rgba[] = [];
    let opacity = 1;
    let base: Rgba | null = null;
    for (let current: Element | null = node; current !== null; current = current.parentElement) {
      const style = getComputedStyle(current);
      if (style.backgroundImage !== "none") return null;
      // Opacity up to and with the opaque layer dims the text over it (the inert tab bar
      // at 45% was 2.47:1); the plan's rule: text × accumulated opacity over that layer.
      opacity *= Number(style.opacity);
      const background = parse(style.backgroundColor);
      if (background !== null && background.a >= 0.999) {
        base = background;
        break;
      }
      if (background !== null && background.a > 0) layers.push(background);
    }
    if (base === null) return null;
    const behind = layers.reverse().reduce((under, layer) => over(layer, under), base);
    const color = parse(paint);
    if (color === null) return null;
    const text = over({ ...color, a: color.a * paintOpacity * opacity }, behind);
    const [light, dark] = [luminance(text), luminance(behind)].sort((a, b) => b - a) as [number, number];
    return (light + 0.05) / (dark + 0.05);
  };
  const inertContrast: string[] = [];
  let inertTexts = 0;
  let lowestContrast = Infinity;
  const inert = [...document.querySelectorAll("[aria-disabled='true'], .ui-tabs[inert] .ui-tabs__tab")].filter((node) => {
    let box = node.getBoundingClientRect();
    if (box.width <= 2 || box.height <= 2 || !node.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    // Hit testing passes through inert nodes: the waiting tab bar counts as drawn.
    if (node.closest("[inert]") !== null) return true;
    if (hits(node, box.left + box.width / 2, box.top + box.height / 2)) return true;
    node.scrollIntoView({ block: "center", inline: "nearest" });
    box = node.getBoundingClientRect();
    return hits(node, box.left + box.width / 2, box.top + box.height / 2);
  });
  /**
   * An icon's glyph: every shape's strongest paint (stroke or fill, with its own opacity
   * and every opacity up to the opaque layer), and the weakest shape is the glyph's ratio.
   */
  const glyphContrastOf = (icon: Element): number | null => {
    const ratios = [...icon.querySelectorAll("path, circle, ellipse, line, polyline, polygon, rect")].flatMap((shape) => {
      const style = getComputedStyle(shape);
      const paints = [
        ...(style.stroke !== "none" && Number.parseFloat(style.strokeWidth) > 0 ? [contrastOf(shape, style.stroke, Number(style.strokeOpacity))] : []),
        ...(style.fill !== "none" ? [contrastOf(shape, style.fill, Number(style.fillOpacity))] : []),
      ].filter((ratio): ratio is number => ratio !== null);
      return paints.length === 0 ? [] : [Math.max(...paints)];
    });
    return ratios.length === 0 ? null : Math.min(...ratios);
  };
  const inertIcons: string[] = [];
  const iconControls: string[] = [];
  let lowestIcon = Infinity;
  for (const control of inert) {
    const texts = [control, ...control.querySelectorAll("*")].filter((node) =>
      [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && (child.textContent ?? "").trim() !== "")
      && node.getBoundingClientRect().width > 2 && node.checkVisibility({ opacityProperty: true, visibilityProperty: true }));
    for (const node of texts) {
      const ratio = contrastOf(node);
      if (ratio === null) continue;
      inertTexts += 1;
      lowestContrast = Math.min(lowestContrast, ratio);
      if (ratio < 4.5) inertContrast.push(`${describe(node)} ${ratio.toFixed(2)}:1`);
    }
    // No visible text: the glyph is the control's only visible name, a non-text element
    // held to 3:1.
    if (texts.length > 0) continue;
    for (const icon of control.querySelectorAll("svg")) {
      if (!icon.checkVisibility({ opacityProperty: true, visibilityProperty: true }) || icon.getBoundingClientRect().width <= 2) continue;
      const ratio = glyphContrastOf(icon);
      if (ratio === null) continue;
      lowestIcon = Math.min(lowestIcon, ratio);
      iconControls.push(`${describe(control)} ${ratio.toFixed(2)}:1`);
      if (ratio < 3) inertIcons.push(`${describe(control)} ${ratio.toFixed(2)}:1`);
    }
  }

  const levels = [...document.querySelectorAll("h1, h2, h3, h4, h5, h6, [role=heading]")]
    .filter((node) => node.checkVisibility())
    .map((node) => ({ node, level: Number(node.getAttribute("aria-level") ?? node.tagName.slice(1)) }));
  const headings = levels.flatMap(({ node, level }, index) => {
    const previous = index === 0 ? 0 : (levels[index - 1]?.level ?? 0);
    return level > previous + 1 ? [`${describe(node)} is h${level} after h${previous}`] : [];
  });
  return {
    targets,
    inertContrast,
    inertIcons,
    iconControls,
    headings,
    counts: { targets: measured, inertTexts, inertIcons: iconControls.length, headings: levels.length },
    lowest: {
      reach: Number.isFinite(lowestReach) ? Math.round(lowestReach * 10) / 10 : null,
      inertContrast: Number.isFinite(lowestContrast) ? Math.round(lowestContrast * 100) / 100 : null,
      inertIconContrast: Number.isFinite(lowestIcon) ? Math.round(lowestIcon * 100) / 100 : null,
    },
  };
}

/**
 * Tab from the body through up to `limit` stops: each one's outline or box-shadow, or
 * that of one of its three closest ancestors (a ring drawn by :focus-within), differs
 * from rest. Stops at the editor and the command field, where Tab types.
 */
async function ringProblems(page: Page, limit: number): Promise<{ readonly stops: number; readonly problems: readonly string[] }> {
  await page.evaluate(() => {
    // The walk starts from the page's first stop, the wordmark: a blur would leave the
    // browser's starting point where the last focus was (an editor, a search field).
    const first = document.querySelector<HTMLElement>(".ui-topbar a[href]");
    first?.focus();
    first?.blur();
    const look = (node: Element): string => {
      const chain = [node, node.parentElement, node.parentElement?.parentElement, node.parentElement?.parentElement?.parentElement];
      return chain.map((each) => {
        if (each == null) return "";
        const style = getComputedStyle(each);
        return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} ${style.outlineOffset} | ${style.boxShadow}`;
      }).join(" ; ");
    };
    const rest = new Map<Element, string>();
    for (const node of document.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")) rest.set(node, look(node));
    (globalThis as unknown as Record<string, unknown>)["untzelRing"] = { rest, look };
  });
  const problems: string[] = [];
  let stops = 0;
  for (let press = 0; press < limit; press += 1) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const { rest, look } = (globalThis as unknown as { untzelRing: { rest: Map<Element, string>; look: (node: Element) => string } }).untzelRing;
      const active = document.activeElement;
      if (active === null || active === document.body) return { kind: "body" as const, name: "" };
      const name = `${active.tagName.toLowerCase()}.${String(active.className).split(" ")[0] ?? ""} "${active.getAttribute("aria-label") ?? active.textContent?.trim().slice(0, 24) ?? ""}"`;
      if (active.closest(".cm-content, .ut-field") !== null) return { kind: "types" as const, name };
      const before = rest.get(active);
      const own = getComputedStyle(active);
      // A stop drawn after the rest was read: any outline or shadow of its own counts.
      const hasRing = before === undefined ? own.outlineStyle !== "none" || own.boxShadow !== "none" : before !== look(active);
      return { kind: hasRing ? ("ring" as const) : ("bare" as const), name };
    });
    if (stop.kind === "types") break;
    // Past the page's last stop the browser's own chrome takes the focus: the end.
    if (stop.kind === "body") {
      if (press === 0) problems.push("the first Tab found no stop");
      break;
    }
    stops += 1;
    if (stop.kind === "bare") problems.push(`${stop.name} draws no ring`);
  }
  return { stops, problems };
}

for (const width of WIDTHS) {
  for (const state of STATES) {
    test(`the floor holds in ${state.name} at ${width}`, async ({ page }) => {
      test.setTimeout(90_000);
      const errors = collectErrors(page);
      await page.setViewportSize(VIEWPORTS[width]);
      await state.open(page, width);
      const report = await page.evaluate(measureFloor);
      writeMeasurement(`a11y-floor-${state.name.replace(/\W+/g, "-").toLowerCase()}-${width}`, { counts: report.counts, lowest: report.lowest });
      expect(report.counts.targets, "targets measured").toBeGreaterThan(0);
      expect(report.counts.headings, "headings measured").toBeGreaterThan(0);
      expect(report.targets, "targets under 44 × 44").toEqual([]);
      expect(report.inertContrast, "inert labels under 4.5:1").toEqual([]);
      expect(report.inertIcons, "inert icon-only glyphs under 3:1").toEqual([]);
      expect(report.headings, "headings that skip a level").toEqual([]);
      const rings = await ringProblems(page, 40);
      expect(rings.stops, "Tab stops walked").toBeGreaterThan(0);
      expect(rings.problems, "Tab stops without a ring").toEqual([]);
      expect(errors).toEqual([]);
    });
  }
}

// The icon at 50% over text-muted was 2.60:1 on surface-raised in
// the round buttons that show nothing but a glyph. Previous bar is inert on bar 1, Octave
// down at the bottom of the picker's range; both are measured, at 3:1 or more.
test("inert icon-only buttons keep their glyph at 3:1: Previous bar and Octave down, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  await openDetail(page, "bass", 390);
  const detail = page.locator("#ui-detail");
  // Two bars: the bar editor's header shows only past one, with Previous bar inert on bar 1.
  await detail.getByRole("button", { name: "Pattern length 1 bar" }).click();
  const lengths = page.getByRole("dialog", { name: /length/i });
  await lengths.getByRole("button", { name: "2 bars", exact: true }).click();
  await expect(lengths).toBeHidden();
  await expect(detail.getByRole("button", { name: "Previous bar", exact: true })).toHaveAttribute("aria-disabled", "true");
  await detail.locator(".ui-sheet__body").evaluate((body) => body.scrollTo({ top: 0 }));
  await detail.getByRole("table", { name: "Steps, bar 1" }).getByRole("button", { name: "Step 2, c2" }).dispatchEvent("click");
  const lower = detail.locator(".ui-picker").getByRole("button", { name: "Octave down", exact: true });
  await expect(lower).toBeVisible();
  for (let press = 0; press < 10 && (await lower.getAttribute("aria-disabled")) !== "true"; press += 1) await lower.click();
  await expect(lower).toHaveAttribute("aria-disabled", "true");
  const report = await page.evaluate(measureFloor);
  expect(report.iconControls.join("\n"), "Octave down is measured").toMatch(/"Octave down" \d+\.\d+:1/);
  expect(report.inertIcons, "inert icon-only glyphs under 3:1").toEqual([]);
  // The picker covers the bar editor's header: Previous bar is measured with the picker closed.
  await detail.locator(".ui-picker").getByRole("button", { name: "Close", exact: true }).click();
  await expect(detail.locator(".ui-picker")).toBeHidden();
  const closed = await page.evaluate(measureFloor);
  expect(closed.iconControls.join("\n"), "Previous bar is measured").toMatch(/"Previous bar" \d+\.\d+:1/);
  expect(closed.inertIcons, "inert icon-only glyphs under 3:1").toEqual([]);
  writeMeasurement("a11y-floor-inert-icons-390", { open: report.iconControls, closed: closed.iconControls });
  expect(errors).toEqual([]);
});

test("with reduced motion nothing animates, playing and in the detail, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  const running = (): Promise<string[]> => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").map((animation) => {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
    return `${animation.constructor.name} on ${target?.className ?? "?"}`;
  }));
  expect(await running(), "playing").toEqual([]);
  await openDetail(page, "kick", 390);
  expect(await running(), "the detail open").toEqual([]);
  expect(errors).toEqual([]);
});

// Descriptions are hidden nodes, never loose text in the banner, and the
// detail is named by its track (it read "Rename track bass").
test("the banner holds no loose description and the detail reads its track's name, at 390", async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.goto("./?template=phase1-onboard");
  const banner = page.getByRole("banner");
  await expect(page.getByRole("button", { name: "Tap to play" })).toBeVisible();
  expect(await banner.ariaSnapshot()).not.toMatch(/Press play first|Rename song/);
  await startSession(page);
  expect(await banner.ariaSnapshot()).not.toMatch(/Press play first|Rename song/);
  await openDetail(page, "bass", 390);
  const detail = await page.locator("#ui-detail").ariaSnapshot();
  expect(detail).toMatch(/^- dialog "bass":\n {2}- heading "bass" \[level=2\]:\n {4}- button "bass"/);
  expect(errors).toEqual([]);
});

test("a code error and a broken file reach the polite status region", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS[390]);
  await startSession(page);
  const status = page.locator(".ui-app > [role='status']");
  await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
  await expect(page.locator("#ui-code .cm-content")).toBeVisible();
  expect(await lineOf(page, "kick:")).toMatch(/^kick:\s+kick\s/);
  await page.evaluate(() => {
    const hooks = (globalThis as unknown as { untzelTest: Hooks & { session(): { source: string } } }).untzelTest;
    hooks.applyText(hooks.session().source.replace(/^(kick:\s+)kick/m, "$1kik"));
  });
  await expect(status).toHaveText(/^Line \d+: .*"kik".* The previous version keeps playing\.$/, { timeout: 5_000 });
  await page.keyboard.press("Escape");
  await page.locator('input[type="file"]').setInputFiles({ name: "broken.untzel", mimeType: "", buffer: Buffer.from("// untzel 1\nkick: x... ~~~") });
  await expect(status).toHaveText(/^This file has errors: /, { timeout: 5_000 });
});
