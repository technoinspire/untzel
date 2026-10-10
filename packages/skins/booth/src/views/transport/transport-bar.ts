// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { collapseToggleLabel } from "../../behavior/preferences/collapse";
import { button, element, setAttributes, setPressed } from "../dom";
import { cpuLabel, lengthChipLabel, loopLengthLabel } from "../../behavior/text/format";
import { icon } from "../icons";
import type { PlaybackIntents, RangeIntents } from "@untzel/skin-contract";
import type { PlaybackMode, PlayRangeView, TransportView } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";
import { createCpuMeter } from "./cpu-meter";
import { lazyRangeStrip } from "../range/lazy-range-strip";
import { createLengthChip } from "../song-settings/length-chip";
import { createModeSwitch } from "./mode-switch";
import type { EditingBarView } from "../range/range-ruler-model";
import { createTransportInfo } from "./transport-info";
import { createTransportTempoKey, type TransportTempoKey } from "./transport-tempo-key";

export interface TransportBarOptions {
  /** Opens or closes the code view (Code next to Drop). */
  readonly onCode: () => void;
  /** Hides or shows the editing area so the stage fills the screen. */
  readonly onToggleControls: () => void;
  /** Opens the loop length picker (one chip, no row of 16 bars). */
  readonly onLength: () => void;
  /** Ids of what the toggle hides, for aria-controls. */
  readonly controls: readonly string[];
  /** The BPM and the key open their editors. */
  readonly onTempo: (button: HTMLButtonElement) => void;
  readonly onKey: (button: HTMLButtonElement) => void;
  /** Undo and Redo by touch, shown below 1200 px. */
  readonly history: HTMLElement;
}

/** Shell state the bar reflects but does not own. */
export interface TransportLayout {
  readonly isCodeOpen: boolean;
  readonly isCollapsed: boolean;
  readonly isLengthOpen: boolean;
}

export interface TransportBar {
  readonly root: HTMLElement;
  /** Takes the focus the waiting screen lost when the music starts. */
  readonly play: HTMLButtonElement;
  readonly code: HTMLButtonElement;
  readonly toggle: HTMLButtonElement;
  /** The Length chip (loop mode only). */
  readonly length: HTMLButtonElement;
  /** The tempo and key buttons, which their editors return focus to and open under. */
  readonly tempoKey: TransportTempoKey;
  /** `editing`: the bar in edit in the track detail, outlined on the range ruler; null when it is closed. */
  update(transport: TransportView, playRange: PlayRangeView, editing: EditingBarView | null): void;
  setLayout(layout: TransportLayout): void;
}

/**
 * Play/stop, tempo, key and position, mode switch, CPU, the Length chip (loop), Code,
 * Drop and the toggle, and under them the play range: its row and
 * its ruler, the loop's bars or the song's parts. How long the loop is lives in one chip;
 * which bars play, in the range ruler.
 */
/** What the mode lets the bar offer: the Length chip only in loop, Drop inert in song. */
export function modeControls(mode: PlaybackMode): { readonly showsLength: boolean; readonly isDropDisabled: boolean } {
  const isLoop = mode === "loop";
  return { showsLength: isLoop, isDropDisabled: !isLoop };
}

/**
 * Play/stop, tempo, key and position, mode switch, CPU, the Length chip (loop), Code,
 * Drop and the toggle, and under them the play range: its row and
 * its ruler, the loop's bars or the song's parts. How long the loop is lives in one chip;
 * which bars play, in the range ruler.
 */
// Over 40 lines: one bar built and updated; its parts are their own views.
export function createTransportBar(intents: PlaybackIntents & RangeIntents, options: TransportBarOptions): TransportBar {
  const playIcon = icon("play");
  const pauseIcon = icon("pause");
  const play = button("ui-round ui-transport__play", text.play, () => intents.togglePlay(), [playIcon, pauseIcon]);
  const tempoKey = createTransportTempoKey({ onTempo: options.onTempo, onKey: options.onKey });
  const info = createTransportInfo(tempoKey.root);
  const modes = createModeSwitch(intents);
  const cpu = createCpuMeter();

  const length = createLengthChip("ui-transport__length", options.onLength);
  setAttributes(length.root, { "aria-keyshortcuts": "[ ]" });

  const code = button("ui-pill ui-transport__code", text.code, options.onCode, [
    icon("code"),
    element("span", { text: text.code }),
  ]);
  code.removeAttribute("aria-label");
  setPressed(code, false);

  const drop = button("ui-pill ui-transport__drop", text.drop, () => {
    if (drop.getAttribute("aria-disabled") !== "true") intents.drop();
  }, [
    icon("drop"),
    element("span", { text: text.drop }),
  ]);
  drop.removeAttribute("aria-label");

  // The play range loads with the first running view, outside the initial JS
  // (60 KB budget): until then its line is an empty slot of the same size.
  const rangeSlot = element("div", { className: "ui-transport__range" });
  const actions = element("div", { className: "ui-transport__actions" }, [length.root, code, drop]);

  const toggle = button("ui-round ui-transport__toggle", collapseToggleLabel(false), options.onToggleControls, [icon("chevron")]);
  setAttributes(toggle, { "aria-controls": options.controls.join(" "), "aria-keyshortcuts": "H" });

  options.history.classList.add("ui-transport__history");
  const root = element("section", { className: "ui-transport", attributes: { "aria-label": text.transport } }, [
    play,
    info.root,
    modes.root,
    cpu.root,
    actions,
    options.history,
    toggle,
    rangeSlot,
  ]);
  const range = lazyRangeStrip(intents, rangeSlot, (strip) => {
    // While a first tap waits, Play from here takes the Length chip's place (the inert
    // Drop's in song mode), so nothing above the ruler moves between the two taps.
    actions.insertBefore(strip.playFrom, code);
  }, (isPending) => {
    root.dataset["pending"] = String(isPending);
  });
  let isLengthOpen = false;
  let loopBars = 4;

  return {
    root,
    play,
    code,
    toggle,
    length: length.root,
    tempoKey,
    update(transport, playRange, editing) {
      const shown = modeControls(transport.mode);
      setPressed(play, transport.isPlaying);
      root.dataset["mode"] = transport.mode;
      info.update(transport, playRange);
      tempoKey.update(transport);
      range.update(playRange, editing);
      loopBars = transport.loopBars;
      length.root.hidden = !shown.showsLength;
      length.update(lengthChipLabel(loopBars), loopLengthLabel(loopBars), isLengthOpen);
      info.setCpu(cpuLabel(transport.cpu));
      cpu.update(transport.cpu);
      modes.update(transport.mode);
      setAttributes(drop, { "aria-disabled": shown.isDropDisabled ? "true" : null });
      setPressed(drop, transport.isDropArmed);
    },
    setLayout(layout) {
      // Hidden controls, or the Code sheet that hides the range line under 1200 px.
      if (layout.isCollapsed || layout.isCodeOpen) range.cancelPending();
      setPressed(code, layout.isCodeOpen);
      isLengthOpen = layout.isLengthOpen;
      length.root.setAttribute("aria-expanded", String(isLengthOpen));
      const label = collapseToggleLabel(layout.isCollapsed);
      setAttributes(toggle, { "aria-expanded": String(!layout.isCollapsed), "aria-label": label, title: `${label} (H)` });
    },
  };
}
