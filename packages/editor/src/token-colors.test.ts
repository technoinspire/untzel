// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TOKEN_CLASSES } from "./highlight/syntax";

// Every category of the language has a rule, every token color clears 4.5:1 on the panel
// surface, and keywords are warm white 600, a color no other category uses. code-panel-colors.browser.ts measures the
// same colors on the rendered page.

const CSS = readFileSync(new URL("./styles/language.css", import.meta.url), "utf8");
const SURFACE = "#161719";
const KEYWORD = "#ece6e0";

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * channel(value >> 16) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** "--u-tok-keyword: #ece6e0;" -> ["keyword", "#ece6e0"]. */
const TOKEN_COLORS = new Map([...CSS.matchAll(/--u-tok-([a-z]+): (#[0-9a-f]{6});/g)].map(([, name, hex]) => [name ?? "", hex ?? ""]));

const RULES = CSS.replace(/\/\*[\s\S]*?\*\//g, "");

function ruleOf(className: string): string | undefined {
  return [...RULES.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, selectors]) => (selectors ?? "").split(",").some((selector) => selector.trim() === `.${className}`))?.[2];
}

describe("token colors", () => {
  it.each([...TOKEN_COLORS])("--u-tok-%s %s clears 4.5:1 on the panel", (_, hex) => {
    expect(contrast(hex, SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it("keywords are warm white 600, a color of their own", () => {
    expect(TOKEN_COLORS.get("keyword")).toBe(KEYWORD);
    expect(ruleOf(TOKEN_CLASSES.keyword)).toMatch(/font-weight: 600;/);
    const others = [...TOKEN_COLORS].filter(([name]) => name !== "keyword").map(([, hex]) => hex);
    expect(others).not.toContain(KEYWORD);
  });

  it("every category the language highlights has a rule, except the ones painted per step or per track", () => {
    // Hits get one class per step (u-hit, u-rest, …); track names and section members
    // get the track's color from the outline (styles/track-colors.css).
    const paintedElsewhere = new Set([TOKEN_CLASSES.hits, TOKEN_CLASSES.member]);
    for (const className of Object.values(TOKEN_CLASSES)) {
      if (!paintedElsewhere.has(className)) expect(ruleOf(className), className).toBeDefined();
    }
  });
});
