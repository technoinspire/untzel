// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The editor under the static production CSP, without a nonce: the harness serves the
// policy documented in the hosting section of the public docs on every response, CodeMirror
// and the editor CSS apply through constructed sheets, no <style> element exists, the editor
// CSS still wins CodeMirror's ties, and not one securitypolicyviolation fires. Runs in
// Chrome, and in WebKit and Firefox with `pnpm test:browser --engines`.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { EXPECTED, SAMPLE, openCode, type Hooks } from "../../support/code-panel-support";
import { collectErrors } from "../../../../support/support";

const HOSTING_DOC = join(process.cwd(), "../docs/content/developers.md");
/** The sample with one unknown sound, so one line carries an error underline. */
const WITH_ERROR = SAMPLE.replace("| delay 1/8 | free\n", "| delay 1/8 | free\nclap: kik .... x... .... x...\n");
/**
 * Measured on the bundle before the static CSP (no CSP, CodeMirror in a <style> before the
 * editor CSS), installed Chrome, 390 px: the hanging indent of a "hat:" line (u-hang-13).
 */
const CHROME_HANG_13_AT_390 = { paddingLeft: "97.5px", textIndent: "-97.5px" };

interface ViolationLog {
  untzelCspViolations?: string[];
}

/** The directives of the policy block of the hosting section, the documented source of the header. */
function documentedDirectives(): string[] {
  const blocks = [...readFileSync(HOSTING_DOC, "utf8").matchAll(/```text\n([\s\S]*?)```/g)].map((match) => match[1] ?? "");
  const policy = blocks.find((block) => block.includes("default-src"));
  if (policy === undefined) throw new Error("apps/docs/content/developers.md has no policy block");
  return directives(policy);
}

function directives(policy: string): string[] {
  return policy.split(";").map((entry) => entry.trim()).filter((entry) => entry !== "");
}

async function recordViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const log: string[] = [];
    (globalThis as unknown as ViolationLog).untzelCspViolations = log;
    document.addEventListener("securitypolicyviolation", (event) => {
      log.push(`${event.effectiveDirective} ${event.blockedURI} ${event.sample}`);
    });
  });
}

function violations(page: Page): Promise<string[]> {
  return page.evaluate(() => [...((globalThis as unknown as ViolationLog).untzelCspViolations ?? [])]);
}

function computed(page: Page, selector: string, property: string): Promise<string> {
  return page.locator(selector).first().evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);
}

test("the harness serves the documented static policy", async ({ page }) => {
  const response = await page.request.get("./");
  const header = response.headers()["content-security-policy"] ?? "";
  expect(directives(header)).toEqual(documentedDirectives());
  expect(header).not.toContain("nonce-");
  expect(header).not.toContain("'unsafe-inline'");
  expect(directives(header)).toContain("style-src 'self'");
});

for (const width of [390, 1440] as const) {
  test(`the editor is styled under the static CSP at ${width}, with no violation`, async ({ page, browserName }) => {
    const errors = collectErrors(page);
    await recordViolations(page);
    await openCode(page, width, WITH_ERROR);
    await page.evaluate(() => (globalThis as unknown as { untzelTest: Hooks }).untzelTest.stop());
    await page.evaluate(() => document.fonts.ready);

    // No <style>: every rule is in a constructed sheet.
    const sheets = await page.evaluate(() => ({
      styleElements: document.querySelectorAll("style").length,
      adopted: document.adoptedStyleSheets.length,
    }));
    expect(sheets.styleElements, "<style> elements").toBe(0);
    expect(sheets.adopted, "CodeMirror's sheet and the editor's").toBeGreaterThanOrEqual(2);

    // CodeMirror's base theme and the Untzel theme (packages/editor/src/highlight/theme.ts) apply.
    expect(await computed(page, "#ui-code .cm-editor", "display")).toBe("flex");
    expect(await computed(page, "#ui-code .cm-gutters", "background-color")).toBe("rgb(22, 23, 25)");
    expect(await computed(page, "#ui-code .cm-line", "padding-right")).toBe("2px");
    // The editor CSS (styles/language.css) applies.
    expect(await computed(page, ".cm-content .u-tok-keyword", "color")).toBe(EXPECTED["u-tok-keyword"]);
    expect(await computed(page, ".cm-content .u-tok-keyword", "font-weight")).toBe("600");

    // The editor CSS still wins CodeMirror's ties, as before the static CSP.
    await expect(page.locator(".cm-lintRange-error").first()).toBeVisible();
    expect(await computed(page, ".cm-lintRange-error", "background-image"), "no CodeMirror squiggle under ours").toBe("none");
    expect(await computed(page, ".cm-lintRange-error", "text-decoration-style")).toBe("wavy");
    expect(await computed(page, ".cm-line.u-block-sections--first", "padding-top")).toBe("6px");
    if (width === 390) {
      const hat = page.locator(".cm-line.u-hang-13", { hasText: /^hat:/ });
      const hang = await hat.evaluate((node) => {
        const style = getComputedStyle(node);
        return { paddingLeft: style.paddingLeft, textIndent: style.textIndent };
      });
      const plain = Number.parseFloat(await computed(page, "#ui-code .cm-line", "padding-left"));
      // 13ch over the theme's 7ch, whatever the engine's monospace font measures.
      expect(Number.parseFloat(hang.paddingLeft) / plain).toBeCloseTo(13 / 7, 2);
      expect(Number.parseFloat(hang.textIndent)).toBeCloseTo(-Number.parseFloat(hang.paddingLeft), 2);
      if (browserName === "chromium") expect(hang).toEqual(CHROME_HANG_13_AT_390);
    }

    // Completion (a CodeMirror tooltip) in the stage's black.
    await page.locator(".cm-line", { hasText: /^ride:/ }).click();
    await expect(page.locator("#ui-code .cm-editor")).toHaveClass(/cm-focused/);
    await page.keyboard.press("End");
    await page.keyboard.type(" | o");
    // Typing opens it; on a loaded machine (check:full, load 20) it once did not, so ask
    // for it too (Ctrl-Space, CodeMirror's completion key). This test is about its style.
    const completion = page.locator(".cm-tooltip-autocomplete");
    await expect(async () => {
      if (!(await completion.isVisible())) await page.keyboard.press("Control+Space");
      await expect(completion).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 15_000 });
    expect(await computed(page, ".cm-tooltip", "background-color")).toBe("rgb(11, 11, 12)");
    await page.keyboard.press("Escape");

    // The command line, styled by the editor CSS.
    await page.getByRole("button", { name: "Commands" }).click();
    await expect(page.locator(".ut-terminal")).toBeVisible();

    expect(await violations(page), "securitypolicyviolation events").toEqual([]);
    expect(errors).toEqual([]);
  });
}
