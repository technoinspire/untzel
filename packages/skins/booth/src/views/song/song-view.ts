// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { PlaybackIntents, RangeIntents, SongIntents } from "@untzel/skin-contract";
import type { UntzelView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";
import { createPartList } from "./part-list";
import { listHint } from "../range/part-range-model";

// The Song view: "Song", the Loop / Song switch
// (the phone has no other), the steps hint, the parts in playing order and "Add part
// from what is playing". No track × section matrix. In loop mode the arrangement is not
// shown: only the way to the song and the button that starts it.

export interface SongViewCallbacks {
  readonly onOpenPart: (part: number) => void;
  /** A row's pencil: open the part with its name in edit. */
  readonly onRenamePart: (part: number) => void;
}

export interface SongList {
  readonly root: HTMLElement;
  /** `openPart` is the part whose editor is open, or null. */
  update(view: UntzelView, openPart: number | null): void;
  /** part-list.ts, rowFor: where focus goes back by part, not by row. */
  rowFor(opener: HTMLElement, part: number): HTMLElement | null;
}

/** Song mode needs a part; without one, the Song view says how to make the first. */
export function songModeState(partCount: number): { readonly isSongDisabled: boolean; readonly note: string } {
  const hasParts = partCount > 0;
  return { isSongDisabled: !hasParts, note: hasParts ? strings.songInLoop : strings.noParts };
}

// Over 40 lines: one view built and updated; its part list is part-list.ts.
export function createSongView(intents: SongIntents & PlaybackIntents & RangeIntents, callbacks: SongViewCallbacks): SongList {
  const title = element("h2", { className: "ui-song__title", text: strings.song, attributes: { id: "ui-song-title" } });
  const loopMode = button("ui-segmented__option", strings.loop, () => intents.setMode("loop"));
  const songMode = button("ui-segmented__option", strings.song, () => intents.setMode("song"));
  const modes = element("div", { className: "ui-segmented ui-song__modes", attributes: { role: "group", "aria-label": strings.mode } }, [loopMode, songMode]);
  // In song mode the range hint stands in for the three steps,
  // which the part editor still walks through. The bracket is drawn; the words are read.
  const hintIcon = icon("brackets");
  hintIcon.classList.add("ui-song__hint-icon");
  const hintText = element("span", { attributes: { "aria-hidden": "true" } });
  const hintSpoken = element("span", { className: "ui-visually-hidden" });
  const hint = element("p", { className: "ui-song__hint" }, [hintIcon, hintText, hintSpoken]);
  const note = element("p", { className: "ui-song__note" });
  const list = createPartList(callbacks.onOpenPart, callbacks.onRenamePart, intents);
  const add = button("ui-pill ui-pill--outline ui-song__add", strings.addPartFromPlaying, () => intents.addPartFromPlaying(), [
    icon("plus"),
    element("span", { text: strings.addPartFromPlaying }),
  ]);
  add.removeAttribute("aria-label");
  const root = element("section", { className: "ui-song", attributes: { "aria-labelledby": "ui-song-title" } }, [
    element("div", { className: "ui-song__head" }, [title, modes]),
    hint,
    note,
    element("div", { className: "ui-song__scroller" }, [list.root, add]),
  ]);

  return {
    root,
    update(view, openPart) {
      const isSong = view.transport.mode === "song";
      const parts = songModeState(view.song.parts.length);
      setPressed(loopMode, !isSong);
      setPressed(songMode, isSong);
      setAttributes(songMode, { "aria-disabled": parts.isSongDisabled ? "true" : null });
      hint.hidden = !isSong;
      list.root.hidden = !isSong;
      note.hidden = isSong;
      setText(note, parts.note);
      const words = listHint(view.playRange.range !== null);
      setText(hintText, ` ${words.visible}`);
      setText(hintSpoken, words.accessible);
      if (isSong) list.update(view.song, openPart, view.playRange.mode === "song" ? view.playRange.range : null);
    },
    rowFor: (opener, part) => list.rowFor(opener, part),
  };
}
