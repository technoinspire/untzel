// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A note on a step: the step opens the note picker, the octave buttons bring the key
// into its two octaves, the key is heard, and Choose writes it.
import { liveStrings as strings, spokenNote } from "@untzel/skin-booth";
import type { DemoAction } from "../../../actions";
import type { Gesture, GestureLocator } from "../../gesture-page";
import { openTrack, showBar, stepButton, startingWith } from "../track-panel";

/** How long Choose takes to show after a key is heard. */
const CHOOSE_SHOWS_MS = 300;

const NOTE = /^([a-g][b#]?)(-?\d+)$/;

/** The same note `delta` octaves away: "c3", 1 → "c4". */
export function octaveAway(note: string, delta: number): string | null {
  const match = NOTE.exec(note);
  if (match === null) return null;
  return `${match[1] ?? ""}${Number(match[2]) + delta}`;
}

/** Octave − or + until the key of `note` shows; the picker shows two octaves at a time. */
async function bringIntoView(detail: GestureLocator, note: string): Promise<GestureLocator> {
  const keyOf = (name: string): GestureLocator => detail.getByRole("button", { name: spokenNote(name, false), exact: true });
  const key = keyOf(note);
  if (await key.isVisible()) return key;
  for (const delta of [1, 2, 3, 4]) {
    for (const direction of [-1, 1] as const) {
      const shown = octaveAway(note, direction * delta);
      if (shown === null || !(await keyOf(shown).isVisible())) continue;
      // The key an octave below is on screen: the window goes up, and the other way round.
      const button = detail.getByRole("button", { name: startingWith(direction < 0 ? strings.octaveUp : strings.octaveDown) });
      for (let press = 0; press < delta; press += 1) await button.click();
      return key;
    }
  }
  return key;
}

export const setStepNote: Gesture<Extract<DemoAction, { kind: "setStepNote" }>> = async (page, action, context) => {
  const detail = await openTrack(page, action.track, context);
  const grid = await showBar(detail, action.track, action.bar);
  await stepButton(grid, action.step).click();
  const key = await bringIntoView(detail, action.note);
  await key.click();
  // A first tap hears the key and offers Choose; a tap on the key the picker already held
  // ready (a rest opens on the note before it) writes it at once.
  const choose = detail.getByRole("button", { name: `${strings.choose} ${action.note}`, exact: true });
  try {
    await choose.waitFor({ timeout: CHOOSE_SHOWS_MS });
  } catch {
    return;
  }
  await choose.click();
};
