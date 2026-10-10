// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Add track: the sheet, the instrument searched by name, heard, its sound picked while it
// plays, and added. The new track's detail opens by itself.
import { liveStrings as strings } from "@untzel/skin-booth";
import type { DemoAction } from "../../actions";
import type { Gesture, GestureLocator } from "../gesture-page";
import { reveal } from "./track-panel";

/** How long the sounds of a previewed instrument take to show. */
const SOUNDS_SHOW_MS = 1_000;

/**
 * Preview: its row opens the sounds while it plays. A program the Code panel applies on the
 * next bar ends a preview that started before it, so a stopped preview is played again.
 */
async function audition(sheet: GestureLocator, instrument: string): Promise<void> {
  const sounds = sheet.getByRole("group", { name: strings.instrumentSounds(instrument), exact: true });
  for (let attempt = 0; ; attempt += 1) {
    await sheet.getByRole("button", { name: strings.previewInstrument(instrument), exact: true }).click();
    try {
      await sounds.waitFor({ timeout: SOUNDS_SHOW_MS });
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
    }
  }
}

export const addTrack: Gesture<Extract<DemoAction, { kind: "addTrack" }>> = async (page, action, context) => {
  const manifest = context.registry.get(action.instrument);
  if (manifest === undefined) throw new Error(`no instrument ${action.instrument}`);
  await (await reveal(page, page.getByRole("button", { name: strings.addTrack, exact: true }).first(), context.isPhone)).click();
  const sheet = page.getByRole("dialog", { name: strings.addTrack, exact: true });
  const search = sheet.getByRole("combobox", { name: strings.searchInstruments, exact: true });
  // The sheet keeps the last search: it is selected and typed over.
  await search.click();
  await search.press("ControlOrMeta+a");
  await search.pressSequentially(action.instrument);
  await audition(sheet, action.instrument);
  const sound = action.preset;
  if (sound === null || sound === manifest.defaultPreset) {
    await sheet.getByRole("button", { name: strings.addInstrument(action.instrument), exact: true }).last().click();
    return;
  }
  await sheet.getByRole("group", { name: strings.instrumentSounds(action.instrument), exact: true }).getByRole("button", { name: sound, exact: true }).click();
  await sheet.getByRole("button", { name: `${strings.addInstrument(action.instrument)} · ${sound}`, exact: true }).click();
};
