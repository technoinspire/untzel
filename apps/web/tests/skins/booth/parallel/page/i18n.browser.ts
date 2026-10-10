// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// One translation component, at 390 and 1440: the Language group of the project menu
// changes every visible label without a reload, on the waiting screen and while the
// music plays, #app[lang] follows, the choice survives a reload, the music keeps playing
// in the chosen language, an open diagnostic is in that language, and the attribution
// stays visible.

import { createFormatters, translateCatalog } from "@untzel/i18n";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { phrases as englishPhrases, strings as english } from "../../../../../../../packages/skins/booth/src/copy/strings";
import { phrasesPtBr, stringsPtBr } from "../../../../../../../packages/skins/booth/src/copy/strings.pt-BR";
import { VIEWPORTS, collectErrors, expectAttribution, expectCopyrightNotice } from "../../../../support/support";

interface Hooks {
  contextState(): string;
  rms(): number;
}

const RMS_THRESHOLD = 0.005;
const RMS_SLICE_MS = 500;
const portuguese = translateCatalog(english, [stringsPtBr], "pt-BR", createFormatters("pt-BR"));
const portuguesePhrases = translateCatalog(englishPhrases, [phrasesPtBr], "pt-BR", createFormatters("pt-BR"));
const MUSICAL_LENGTHS = [1, 2, 4, 8, 16] as const;

/** English texts whose pt-BR translation differs: none may stay visible in pt-BR. */
const ENGLISH_ONLY = Object.entries(english)
  .filter(([key, value]) => typeof value === "string" && portuguese[key as keyof typeof english] !== value)
  .map(([, value]) => value as string);

/** Visible text nodes and accessible names of visible controls, in the page. */
async function visibleTexts(page: Page): Promise<readonly string[]> {
  return page.evaluate(() => {
    const texts: string[] = [];
    const visible = (element: Element): boolean => element instanceof HTMLElement && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    const walker = document.createTreeWalker(document.getElementById("app") ?? document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const parent = node.parentElement;
      const value = node.textContent?.trim() ?? "";
      if (parent !== null && value !== "" && visible(parent) && parent.closest(".cm-editor") === null) texts.push(value);
    }
    for (const element of document.querySelectorAll("#app [aria-label]")) {
      if (visible(element)) texts.push(element.getAttribute("aria-label") ?? "");
    }
    return texts;
  });
}

async function expectNoEnglishLeft(page: Page): Promise<void> {
  const left = (await visibleTexts(page)).filter((value) => ENGLISH_ONLY.includes(value));
  expect(left, "English labels still visible in pt-BR").toEqual([]);
}

/** The loudest RMS over one 500 ms slice, as loop-bars.browser.ts reads the music. */
async function sliceRms(page: Page): Promise<number> {
  return page.evaluate(
    (sliceMs) =>
      new Promise<number>((resolve) => {
        const hooks = (globalThis as unknown as { untzelTest: Hooks }).untzelTest;
        let loudest = 0;
        const timer = window.setInterval(() => (loudest = Math.max(loudest, hooks.rms())), 25);
        window.setTimeout(() => {
          window.clearInterval(timer);
          resolve(loudest);
        }, sliceMs);
      }),
    RMS_SLICE_MS,
  );
}

/**
 * Each musical length through the picker, the chip's whole label in view in pt-BR: the
 * longer words once cut the Length chip to "Duração 8 co…" at 390.
 */
async function expectWholePortugueseLabels(page: Page, chip: Locator, label: (bars: number) => string): Promise<void> {
  for (const bars of MUSICAL_LENGTHS) {
    await chip.click();
    const picker = page.locator("#ui-length");
    await expect(picker).toBeVisible();
    await expect(picker.locator(".ui-length__unit").first()).toHaveText("compasso");
    await picker.locator(`.ui-length__option[data-bars="${bars}"]`).click();
    await expect(picker).toBeHidden();
    await expect(chip.locator(".ui-chip-length__label")).toHaveText(label(bars));
    const overflow = await chip.evaluate((node) => {
      const text = node.querySelector(".ui-chip-length__label");
      return [node, text].filter((box): box is Element => box !== null).map((box) => box.scrollWidth - box.clientWidth);
    });
    expect(overflow, `${label(bars)}: label and chip overflow in px`).toEqual([0, 0]);
  }
}
test("the Length and Pattern chips show their whole pt-BR label at 390", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.addInitScript(() => localStorage.setItem("untzel.locale", "pt-BR"));
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Toque para tocar" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await expectWholePortugueseLabels(page, page.locator(".ui-transport__length"), (bars) => portuguesePhrases.lengthChip(bars));
  await page.getByRole("button", { name: portuguese.tuneTrack("kick"), exact: true }).click();
  await expectWholePortugueseLabels(page, page.locator("#ui-detail .ui-detail__length"), (bars) => portuguesePhrases.patternChip(bars));
  await expectAttribution(page);
  expect(errors).toEqual([]);
});
/** Visible texts inside `root` that their box cuts (scrolls wider than it shows). */
async function clippedTexts(root: Locator): Promise<readonly string[]> {
  return root.evaluate((container) =>
    [...container.querySelectorAll("*")]
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }))
      .filter((node) => {
        const style = getComputedStyle(node);
        const clips = style.textOverflow === "ellipsis" || style.overflowX === "hidden" || style.overflowX === "clip";
        return clips && node.textContent.trim() !== "" && node.scrollWidth > node.clientWidth + 1;
      })
      .map((node) => node.textContent.trim()),
  );
}
test("the tempo, key and rename popovers show their whole pt-BR copy at 390", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.addInitScript(() => localStorage.setItem("untzel.locale", "pt-BR"));
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Toque para tocar" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.locator(".ui-tempo-key__tempo").click();
  const tempo = page.locator("#ui-tempo");
  await expect(tempo).toBeVisible();
  await tempo.locator(".ui-tempo__field").fill("999");
  await page.keyboard.press("Enter");
  await expect(tempo.locator(".ui-tempo__message")).toHaveText(/^O tempo vai de 40 a 300 BPM\./);
  expect(await clippedTexts(tempo), "tempo editor").toEqual([]);
  await page.keyboard.press("Escape");
  await page.locator(".ui-tempo-key__key").click();
  const key = page.locator("#ui-key");
  await expect(key.getByRole("heading", { name: "Tom" })).toBeVisible();
  expect(await clippedTexts(key), "key picker").toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: portuguese.tuneTrack("kick"), exact: true }).click();
  const detail = page.locator("#ui-detail");
  // The name is the label, what it does the description.
  const rename = detail.getByRole("button", { name: "kick", exact: true });
  await expect(rename).toHaveAccessibleDescription(portuguese.renameTrackHint);
  await rename.click();
  await detail.getByRole("textbox", { name: portuguese.trackNameField }).fill("Kick Grande");
  await expect(detail.locator(".ui-inline-name__rule")).toHaveText(portuguese.nameInvalid);
  expect(await clippedTexts(detail.locator(".ui-inline-name")), "rename field").toEqual([]);
  await page.keyboard.press("Escape");
  await expectAttribution(page);
  expect(errors).toEqual([]);
});
/**
 * The Code panel and its command line in pt-BR at 390: toggle, field, Run,
 * results, preview, suggestion and quick fix read in Portuguese, the commands stay as
 * written, and no label is cut. The usage hint is one line with an ellipsis by design,
 * so it is left out of the cut check.
 */
test("the Code panel and the command line read whole in pt-BR at 390", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = collectErrors(page);
  await page.setViewportSize(VIEWPORTS[390]);
  await page.addInitScript(() => localStorage.setItem("untzel.locale", "pt-BR"));
  await page.goto("./?template=phase1-onboard");
  await page.getByRole("button", { name: "Toque para tocar" }).click();
  await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
  await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
  const area = page.locator("#ui-code .ut-area");
  await expect(area).toBeVisible();
  const toggle = area.getByRole("button", { name: "Comandos" });
  await toggle.click();
  const input = page.getByRole("combobox", { name: "Comando" });
  await expect(input).toHaveAttribute("placeholder", "Digite um comando");
  const log = page.getByRole("log");
  // The help sits beside the live log and describes the field.
  await expect(page.locator(".ut-empty")).toContainText("Digite um comando, ou help para ver a lista.");
  await expect(input).toHaveAccessibleDescription(/Digite um comando, ou help para ver a lista\./);
  await input.fill("tempo 124");
  await input.press("Enter");
  await expect(log).toContainText("Tempo 124 BPM.");
  await expect(log.locator(".ut-applied__detail").last()).toHaveText(/no próximo compasso|tocando desde o compasso \d+/);
  await input.fill("remove ride");
  await input.press("Enter");
  const preview = page.getByRole("group", { name: /^Prévia · remove ride · 3 linhas$/ });
  await expect(preview.getByRole("button", { name: "Aplicar" })).toBeFocused();
  await expect(preview.getByRole("button", { name: "Cancelar" })).toBeVisible();
  expect(await clippedTexts(preview), "preview").toEqual([]);
  await preview.getByRole("button", { name: "Cancelar" }).click();
  await expect(log).toContainText("Cancelado. Nada mudou.");
  await input.fill("mute kik");
  await input.press("Enter");
  await expect(log).toContainText('Nenhuma faixa se chama "kik".');
  await expect(log.getByRole("button", { name: "mute kick" })).toBeVisible();
  // A quick fix in the editor: the message and its button in pt-BR.
  await page.evaluate(() => {
    const hooks = (globalThis as unknown as { untzelTest: { session(): { source: string }; applyText(text: string): void } }).untzelTest;
    hooks.applyText(hooks.session().source.replace("kick:  kick", "kick:  kik"));
  });
  const problem = page.locator(".untzel-editor__problem").first();
  await expect(problem.locator(".untzel-editor__message")).toHaveText(/^Instrumento desconhecido "kik"\./);
  await expect(problem.getByRole("button", { name: "Trocar por kick" })).toBeVisible();
  await expect(problem.getByRole("button", { name: "Ignorar" })).toBeVisible();
  const cut = (await clippedTexts(page.locator("#ui-code"))).filter((value) => !value.startsWith("set ") && !value.includes(" · "));
  expect(cut, "labels cut in the Code panel").toEqual([]);
  await expectAttribution(page);
  expect(errors).toEqual([]);
});

/** Menu, then one of the Language group's radios; the menu stays open, Esc closes it. */
async function chooseLanguage(page: Page, menuName: string, endonym: "Português" | "English"): Promise<void> {
  await page.locator(".ui-topbar").getByRole("button", { name: menuName, exact: true }).click();
  const radio = page.getByRole("menuitemradio", { name: endonym });
  await expect(radio).toHaveAttribute("lang", endonym === "Português" ? "pt-BR" : "en");
  const box = await radio.boundingBox();
  // Rounded as in edit-in-place.browser.ts: at a fractional y the box reads 43.99997 for a 44 px row.
  expect(Math.round(box?.height ?? 0), `${endonym} target`).toBeGreaterThanOrEqual(44);
  await radio.click();
  await expect(radio).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");
}

for (const width of [390, 1440] as const) {
  test(`the menu's Language group at ${width}: no reload, saved, and the music never stops`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectErrors(page);
    await page.setViewportSize(VIEWPORTS[width]);
    await page.goto("./");
    await expect(page.locator("#app")).toHaveAttribute("lang", "en");
    await page.evaluate(() => ((globalThis as unknown as Record<string, unknown>)["untzelNoReload"] = true));
    // The waiting screen's footer carries only the copyright.
    await expect(page.locator(".ui-idle__legal").getByRole("button")).toHaveCount(0);

    await chooseLanguage(page, "Menu", "Português");
    await expect(page.getByRole("button", { name: "Toque para tocar" })).toBeVisible();
    await expect(page.locator("#app")).toHaveAttribute("lang", "pt-BR");
    expect(await page.evaluate(() => (globalThis as unknown as Record<string, unknown>)["untzelNoReload"])).toBe(true);
    await expectNoEnglishLeft(page);
    await expectAttribution(page);
    await expectCopyrightNotice(page);

    // The choice survives a reload, and the music starts in the chosen language.
    await page.reload();
    await expect(page.locator("#app")).toHaveAttribute("lang", "pt-BR");
    await page.getByRole("button", { name: "Toque para tocar" }).click();
    await page.getByRole("button", { name: "Drop", exact: true }).waitFor();
    await page.waitForFunction(() => (globalThis as unknown as { untzelTest?: Hooks }).untzelTest?.contextState() === "running");
    await expect(page.locator(".ui-transport").getByRole("button", { name: /^Duração do loop \d+ compassos?$/ })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 }).getByRole("button")).toHaveAccessibleDescription(portuguese.renameSong);
    await expectNoEnglishLeft(page);
    await expectAttribution(page);

    // The menu itself, open, reads in Portuguese.
    await page.locator(".ui-topbar").getByRole("button", { name: portuguese.menu, exact: true }).click();
    for (const label of [portuguese.newProject, portuguese.openProject, portuguese.renameSong, portuguese.deleteProject]) {
      await expect(page.getByRole("menuitem", { name: label })).toBeVisible();
    }
    await page.keyboard.press("Escape");

    // Back to English while the music plays: the copy follows and the sound never stops.
    await chooseLanguage(page, portuguese.menu, "English");
    await expect(page.locator("#app")).toHaveAttribute("lang", "en");
    await expect(page.locator(".ui-transport").getByRole("button", { name: /^Loop length \d+ bars?$/ })).toBeVisible();
    expect(await sliceRms(page), "the music keeps playing through the switch").toBeGreaterThan(RMS_THRESHOLD);
    await chooseLanguage(page, "Menu", "Português");
    await expect(page.locator("#app")).toHaveAttribute("lang", "pt-BR");

    // A diagnostic in the Code panel is in the chosen language, and the music keeps playing.
    await page.locator(".ui-transport").getByRole("button", { name: "Code", exact: true }).click();
    const content = page.locator(".cm-content");
    await content.waitFor();
    await content.click();
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.type("\ntempo 999");
    const message = page.locator(".untzel-editor__message").first();
    await expect(message).toBeVisible();
    await expect(message).toHaveText(/precisa|vem antes/);
    await expect(page.locator(".untzel-editor__keeps").first()).toHaveText("A versão anterior continua tocando.");
    await expect(content).toHaveAttribute("aria-label", "Código Untzel");
    expect(await sliceRms(page), "the music keeps playing").toBeGreaterThan(RMS_THRESHOLD);
    await expectAttribution(page);
    expect(errors).toEqual([]);
  });
}
