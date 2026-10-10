// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setPressed } from "../dom";
import type { PlaybackIntents } from "@untzel/skin-contract";
import type { PlaybackMode } from "@untzel/presentation/view-model";
import { text } from "../../copy/copy";

/** The Loop/Song segmented group of the transport; the pressed option is the mode playing. */
export function createModeSwitch(intents: Pick<PlaybackIntents, "setMode">): { readonly root: HTMLElement; update(mode: PlaybackMode): void } {
  const loopMode = button("ui-segmented__option", text.loop, () => intents.setMode("loop"));
  const songMode = button("ui-segmented__option", text.song, () => intents.setMode("song"));
  return {
    root: element("div", { className: "ui-segmented ui-transport__modes", attributes: { role: "group", "aria-label": text.mode } }, [loopMode, songMode]),
    update(mode) {
      setPressed(loopMode, mode === "loop");
      setPressed(songMode, mode === "song");
    },
  };
}
