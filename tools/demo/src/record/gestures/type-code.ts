// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Typing in the Code panel, where no control writes the text yet:
// the panel opens, the cursor goes to the place with the keyboard, the text is typed key by
// key (or a few words at a time, for the band and the arrangement), and Mod+Enter applies
// it on the next bar. Home then brings the caret to the start of its line, as a person does
// after a long line: the panel scrolls back, and the track names at the line starts show.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction, TypingPace } from "../../actions";
import { codeTarget } from "../../script/replay";
import type { GestureContext, GestureLocator, GesturePage } from "../gesture-page";
import { burstTexts } from "../gesture-schedule";
import { caretKeys } from "./code-caret";
import { reveal } from "./track-panel";

/**
 * The Code panel's editor, opened from the transport when it is not shown. On a phone the
 * panel beside the stage (a track's detail) covers the transport: it closes first.
 */
export async function openCode(page: GesturePage, isPhone: boolean): Promise<GestureLocator> {
  const editor = page.getByRole("textbox", { name: "Untzel source", exact: true });
  if (await editor.isVisible()) return editor;
  await (await reveal(page, page.getByRole("button", { name: strings.code, exact: true }), isPhone)).click();
  return editor;
}

/** Types `text` over the range [from, to) of the text the panel shows, and applies it. */
export async function typeAt(
  page: GesturePage,
  context: GestureContext,
  range: { readonly from: number; readonly to: number },
  text: string,
  pace: TypingPace = "keys",
): Promise<void> {
  const editor = await openCode(page, context.isPhone);
  await editor.click();
  // The keys go to the focus, the editor: pressing on the editor would focus it again each time.
  for (const key of caretKeys(context.source, range.from, range.to - range.from, context.isPhone).keys) await page.keyboard.press(key);
  if (pace === "bursts") {
    for (const burst of burstTexts(text)) await (burst === "\n" ? page.keyboard.press("Enter") : page.keyboard.insertText(burst));
  } else await editor.pressSequentially(text);
  await page.keyboard.press("ControlOrMeta+Enter");
  await page.keyboard.press("Home");
}

export const typeCode = async (page: GesturePage, action: Extract<DemoAction, { kind: "typeCode" }>, context: GestureContext): Promise<void> => {
  const target = codeTarget(context.source, action.placement, context.registry);
  if (typeof target === "string") throw new Error(`typeCode: ${target}`);
  await typeAt(page, context, target, `${target.lineBreak}${action.text}`, action.pace);
};
