// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setText } from "../dom";
import { icon } from "../icons";
import type { RangeIntents, RenameIntents, SongIntents } from "@untzel/skin-contract";
import type { UntzelView } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";
import { createInlineName } from "../primitives/inline-name";
import { createLengthChip } from "../song-settings/length-chip";
import { partEditorState } from "./part-editor-state";
import { PART_EDITOR_ID } from "./part-row";
import { createPartMove } from "./part-move";
import { partPlayFromNote } from "../range/part-range-model";
import { createSheet, type Sheet } from "../sheets/sheet";
import { createPartTrackToggles } from "./part-track-toggles";

// The editor of one part: its name and length,
// "Tracks in this part" as large toggles (on: flare with dark text; off: an outline and
// "· off"), and Play from here, Duplicate and Move. A track toggle edits the part's section
// line, so a section used by two parts changes in both; the editor says so. What it
// shows comes from part-editor-state.ts.

export interface PartEditorOptions {
  readonly onClose: () => void;
  /** Opens the part length picker (1 2 4 8 16). */
  readonly onLength: () => void;
  /** The part moved: the editor follows it to its new place. */
  readonly onMoved: (part: number) => void;
  /** The polite region, for "Renamed drop to peak." */
  readonly announce: (message: string) => void;
}

export interface PartEditor extends Sheet {
  readonly length: HTMLButtonElement;
  /** The rows' pencil: the name field opens with the focus in it. */
  editName(): void;
  update(view: UntzelView, part: number | null, isLengthOpen: boolean): void;
}

// Over 40 lines: one sheet built and updated; its toggles and its Move row are their own views.
export function createPartEditor(intents: SongIntents & RenameIntents & Pick<RangeIntents, "playFromPart">, options: PartEditorOptions): PartEditor {
  const sheet = createSheet({ id: PART_EDITOR_ID, title: "", className: "ui-sheet--part", onClose: options.onClose });
  // The part's name, edited in place: one edit, the song follows.
  const name = createInlineName({
    kind: "part",
    id: `${PART_EDITOR_ID}-name`,
    onRename: (next) => {
      if (section !== null) intents.renameSection(section, next);
    },
    announce: options.announce,
  });
  sheet.heading.replaceChildren(name.root);
  sheet.heading.after(name.description);
  const length = createLengthChip("ui-part__length", options.onLength);
  sheet.header.insertBefore(length.root, sheet.heading.nextSibling);
  const meta = element("p", { className: "ui-part__meta" });
  sheet.header.insertBefore(meta, length.root.nextSibling);
  const shared = element("p", { className: "ui-part__shared" });
  // Only while the name is edited: what follows the new name (CSS swaps the two lines).
  const follows = element("p", { className: "ui-part__follows" });
  const toggles = createPartTrackToggles(intents, () => section);
  let part: number | null = null;
  let section: string | null = null;

  // Play from here: moves only the range's start; the music goes there on the next bar.
  const playFrom = button("ui-pill ui-pill--raised ui-part__play-from", strings.playFromHere, () => {
    if (part !== null) intents.playFromPart(part);
  }, [icon("play-from"), element("span", { text: strings.playFromHere })]);
  playFrom.removeAttribute("aria-label");
  const duplicate = button("ui-pill ui-pill--raised", strings.duplicate, () => {
    if (part !== null) intents.duplicatePart(part);
  });
  const move = createPartMove(intents, () => part, options.onMoved);
  const playHint = element("p", { className: "ui-part__hint" });
  sheet.body.append(
    shared,
    follows,
    element("p", { className: "ui-detail__label", text: strings.tracksInPart }),
    toggles.root,
    element("div", { className: "ui-part__actions" }, [playFrom, duplicate, move.move]),
    move.row,
    playHint,
  );

  return {
    ...sheet,
    length: length.root,
    editName: () => name.edit(),
    update(view, index, isLengthOpen) {
      const state = index === null ? null : partEditorState(view, index);
      part = state === null ? null : index;
      if (state === null) return;
      section = state.section;
      const sections = new Set(view.song.sections.map((entry) => entry.name).filter((entry) => entry !== state.section));
      name.update(state.section, sections);
      setText(follows, phrases.partFollows(state.section, view.song.parts.filter((entry) => entry.section === state.section).length));
      setText(meta, state.meta);
      setText(shared, state.shared ?? "");
      shared.hidden = state.shared === null;
      length.update(state.lengthLabel, state.lengthName, isLengthOpen);
      toggles.update(state.section, state.tracks);
      const shown = view.song.parts[index ?? 0];
      if (shown !== undefined) setText(playHint, partPlayFromNote(view.playRange, view.song.parts, shown));
      move.update(state.canMoveUp, state.canMoveDown);
    },
  };
}
