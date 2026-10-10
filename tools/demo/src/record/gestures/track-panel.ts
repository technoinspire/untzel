// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The track's detail as a person reaches it: its name in the table on a desktop, Adjust on a
// phone; then the bar to edit, its step grid, and the instrument the track plays.
import { livePhrases as phrases, liveStrings as strings } from "@untzel/skin-booth";
import type { InstrumentManifest } from "@untzel/core";
import { analyze } from "@untzel/language";
import type { GestureContext, GestureLocator, GesturePage } from "../gesture-page";

/** A name that starts with `text`, for controls whose name goes on with a value. */
export function startingWith(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

/** The Close of the panel beside the stage (the Code panel, a track's detail, Add track). */
export async function closeSidePanel(page: GesturePage): Promise<void> {
  await page.getByRole("complementary", { name: strings.sidePanel, exact: true }).getByRole("button", { name: strings.close, exact: true }).first().click();
}

/** With the Code panel open, a track's or a part's name points at its line: the panel closes first. */
export async function closeCode(page: GesturePage): Promise<void> {
  if (await page.getByRole("dialog", { name: strings.code, exact: true }).isVisible()) await closeSidePanel(page);
}

/**
 * A control of the views: on a phone the panel beside the stage (Code, a track's detail)
 * covers them, so it closes first; on a desktop it sits beside them and stays.
 */
export async function reveal(page: GesturePage, control: GestureLocator, isPhone: boolean): Promise<GestureLocator> {
  if (isPhone && (await page.getByRole("complementary", { name: strings.sidePanel, exact: true }).isVisible())) await closeSidePanel(page);
  return control;
}

/** The detail of `track`, opened when it is not the one shown. */
export async function openTrack(page: GesturePage, track: string, context: GestureContext): Promise<GestureLocator> {
  const detail = page.getByRole("dialog", { name: track, exact: true });
  if (await detail.isVisible()) return detail;
  await closeCode(page);
  const opener = context.isPhone
    ? page.getByRole("button", { name: strings.tuneTrack(track), exact: true })
    : page.getByRole("button", { name: startingWith(`${track}, `) });
  await opener.click();
  return detail;
}

/** The grid of `bar` (0-based), after tapping its thumbnail when the pattern has several. */
export async function showBar(detail: GestureLocator, track: string, bar: number): Promise<GestureLocator> {
  const thumbnails = detail.getByRole("group", { name: phrases.barsOfTrack(track), exact: true });
  if (await thumbnails.isVisible()) {
    const thumbnail = thumbnails.getByRole("button", { name: phrases.barName(bar + 1), exact: true });
    if ((await thumbnail.getAttribute("aria-pressed")) !== "true") await thumbnail.click();
  }
  return detail.getByRole("table", { name: `${strings.stepGrid}, bar ${bar + 1}`, exact: true });
}

/** Step `step` (0-based) of a grid: its name goes on with what it plays. */
export function stepButton(grid: GestureLocator, step: number): GestureLocator {
  return grid.getByRole("button", { name: startingWith(`Step ${step + 1},`) });
}

/** The instrument `track` plays in the text as it is before the gesture. */
export function manifestOf(track: string, context: GestureContext): InstrumentManifest {
  const analysis = analyze(context.source, context.registry);
  const instrument = analysis.ok ? analysis.program.tracks.find((entry) => entry.name === track)?.instrument : undefined;
  const manifest = instrument === undefined ? undefined : context.registry.get(instrument);
  if (manifest === undefined) throw new Error(`no track ${track} in the text before the gesture`);
  return manifest;
}
