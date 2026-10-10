// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { TrackIntents } from "@untzel/skin-contract";
import type { TrackView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { bindRangeKeys } from "../../behavior/keyboard/range-keyboard";
import { createMiniSteps, updateMiniSteps } from "../pattern/mini-steps-view";
import { toneRowModel } from "../sound/tone-row-model";

export interface TrackRowCallbacks {
  readonly onSelect: (track: string) => void;
  /** The pencil or a double click on the name: the detail opens with the name in edit. */
  readonly onRename: (track: string) => void;
}

/** What one row of the track table shows for a track at `index` (0-based). */
export interface TrackRowState {
  readonly index: string;
  readonly isSelected: boolean;
  readonly name: string;
  readonly isPatternPressed: boolean;
  /** The tone thumb, 0 to 1000. */
  readonly toneValue: string;
  /** Set by a written parameter: the slider is inert. */
  readonly isToneSetBy: boolean;
  readonly toneValueText: string;
  readonly setBy: string;
}

export function trackRowState(track: TrackView, index: number, selected: string | null): TrackRowState {
  const model = toneRowModel(track.tone, track.toneSetBy);
  return {
    index: String(index + 1),
    isSelected: track.name === selected,
    name: `${track.name}, ${track.instrument}`,
    isPatternPressed: track.playState === "on" || track.playState === "queued",
    toneValue: String(Math.round(track.tone * 1000)),
    isToneSetBy: !model.isActive,
    toneValueText: model.setBy ?? model.display,
    setBy: model.setBy ?? "",
  };
}

// Over 40 lines: one row's cells built in their order, each with its own intent.
export function createRow(name: string, intents: TrackIntents, callbacks: TrackRowCallbacks): HTMLElement {
  const cell = (child: Node, className = ""): HTMLElement =>
    element("span", { className: `ui-table__td ${className}`.trim(), attributes: { role: "cell" } }, [child]);
  const select = button("ui-table__name", name, () => callbacks.onSelect(name), [
    element("span", { className: "ui-table__track" }),
    element("span", { className: "ui-table__instrument" }),
  ]);
  select.addEventListener("dblclick", () => callbacks.onRename(name));
  // Shown on hover and focus, always on a touch screen (hover: none).
  const rename = button("ui-round ui-table__rename", () => strings.renameTrack(name), () => callbacks.onRename(name), [icon("pencil")]);
  const pattern = button("ui-table__pattern", text.trackPlay(name), () => intents.toggleTrack(name), [
    createMiniSteps("ui-table__mini"),
  ]);
  const mute = button("ui-square", `Mute ${name}`, () => intents.setMute(name, mute.getAttribute("aria-pressed") !== "true"));
  mute.textContent = "M";
  setAttributes(mute, { "aria-label": text.muteTrack(name) });
  const solo = button("ui-square", `Solo ${name}`, () => intents.setSolo(name, solo.getAttribute("aria-pressed") !== "true"));
  solo.textContent = "S";
  setAttributes(solo, { "aria-label": text.soloTrack(name) });
  const tone = element("input", {
    className: "ui-range ui-table__tone",
    attributes: { type: "range", min: 0, max: 1000, step: 1, "aria-label": text.trackTone(name) },
  });
  tone.addEventListener("input", () => {
    // Set by a written parameter: the thumb does not move.
    if (tone.getAttribute("aria-disabled") === "true") tone.value = tone.dataset["value"] ?? tone.value;
    else intents.setTone(name, Number(tone.value) / 1000);
  });
  bindRangeKeys(tone);
  const setBy = element("span", { className: "ui-table__set-by" });
  return element("div", { className: "ui-table__row", attributes: { role: "row" } }, [
    cell(element("span", { className: "ui-table__index" }), "ui-table__td--index"),
    element("span", { className: "ui-table__td ui-table__td--name", attributes: { role: "cell" } }, [select, rename]),
    cell(pattern),
    cell(mute, "ui-table__td--center"),
    cell(solo, "ui-table__td--center"),
    element("span", { className: "ui-table__td ui-table__td--tone", attributes: { role: "cell" } }, [tone, setBy]),
  ]);
}

export function updateRow(row: HTMLElement, track: TrackView, index: number, selected: string | null): void {
  const state = trackRowState(track, index, selected);
  row.classList.toggle("is-selected", state.isSelected);
  row.dataset["state"] = track.playState;
  const indexNode = row.querySelector(".ui-table__index");
  if (indexNode !== null) setText(indexNode, state.index);
  const name = row.querySelector<HTMLButtonElement>(".ui-table__name");
  if (name !== null) {
    name.setAttribute("aria-label", state.name);
    if (state.isSelected) name.setAttribute("aria-current", "true");
    else name.removeAttribute("aria-current");
  }
  const trackNode = row.querySelector(".ui-table__track");
  const instrumentNode = row.querySelector(".ui-table__instrument");
  if (trackNode !== null) setText(trackNode, track.name);
  if (instrumentNode !== null) setText(instrumentNode, track.instrument);
  const pattern = row.querySelector<HTMLButtonElement>(".ui-table__pattern");
  if (pattern !== null) setPressed(pattern, state.isPatternPressed);
  const mini = row.querySelector<HTMLElement>(".ui-table__mini");
  if (mini !== null) updateMiniSteps(mini, track.steps);
  const [mute, solo] = Array.from(row.querySelectorAll<HTMLButtonElement>(".ui-square"));
  if (mute !== undefined) setPressed(mute, track.isMuted);
  if (solo !== undefined) setPressed(solo, track.isSoloed);
  const tone = row.querySelector<HTMLInputElement>(".ui-table__tone");
  if (tone !== null && document.activeElement !== tone) tone.value = state.toneValue;
  if (tone !== null) tone.style.setProperty("--fill", String(track.tone));
  if (tone !== null) {
    tone.dataset["value"] = state.toneValue;
    if (state.isToneSetBy) tone.setAttribute("aria-disabled", "true");
    else tone.removeAttribute("aria-disabled");
    tone.setAttribute("aria-valuetext", state.toneValueText);
  }
  row.classList.toggle("is-tone-overridden", state.isToneSetBy);
  const setBy = row.querySelector(".ui-table__set-by");
  if (setBy !== null) {
    setText(setBy, state.setBy);
    // The column can cut the sentence with an ellipsis: the title keeps it whole.
    setAttributes(setBy, { title: state.setBy === "" ? null : state.setBy });
  }
}
