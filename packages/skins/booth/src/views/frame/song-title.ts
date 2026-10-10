// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";
import { clampTitleDraft, commitTitleDraft, songTitleLabel, titleAnnouncement } from "../../behavior/text/song-title-model";
import { strings, text as copy } from "../../copy/copy";
import { bindRenameField, startEditing } from "../primitives/rename-field";
// The song title in the top bar, beside the Untzel wordmark.
// With no project open the h1 holds a hidden "Untzel": the wordmark next to it is
// the visible name, never drawn twice. Idle, a
// button inside the only h1, named by the title and described as "Rename song". Editing,
// the h1 keeps the title in a hidden span and a labelled field takes the button's place,
// with Done. Enter, Done or leaving saves; Esc cancels. Same shape as the track and part
// names' InlineName (root, update, isEditing, edit), so the two can join later.
export interface SongTitleOptions {
  /** Unique per instance: ties the button to its description. */
  readonly id: string;
  readonly onRename: (title: string) => void;
  readonly announce: (message: string) => void;
  /** The field opened or closed: the bar swaps Export for Done on a phone. */
  readonly onEditing: (isEditing: boolean) => void;
}
export interface SongTitle {
  readonly root: HTMLElement;
  update(title: string | null): void;
  isEditing(): boolean;
  /** "Rename song" in the menu. */
  edit(): void;
}
// Over 40 lines: the draft and the title are gesture state that render, commit, close and the field share.
export function createSongTitle(options: SongTitleOptions): SongTitle {
  let title: string | null = null;
  let draft: string | null = null;
  const describedBy = `${options.id}-hint`;
  const text = element("span", { className: "ui-song-title__text" });
  const rename = element("button", { className: "ui-song-title__button", attributes: { type: "button", "aria-describedby": describedBy } }, [text, icon("pencil")]);
  const plain = element("span", { className: "ui-visually-hidden" });
  const hidden = element("span", { className: "ui-visually-hidden" });
  const heading = element("h1", { className: "ui-topbar__title ui-song-title__heading" }, [rename, plain, hidden]);
  // Hidden: aria-describedby still reads it, and the banner holds no loose "Rename song".
  const description = element("span", { text: copy.renameSong, attributes: { id: describedBy, hidden: true } });
  const input = element("input", {
    className: "ui-song-title__field",
    attributes: { type: "text", "aria-label": copy.songTitle, enterkeyhint: "done", autocomplete: "off", spellcheck: "false" },
  });
  const done = button("ui-song-title__done", copy.renameDone, () => commit(false), [icon("check")]);
  const hint = element("p", { className: "ui-song-title__hint", text: copy.renameHint, attributes: { "aria-hidden": "true" } });
  const editor = element("div", { className: "ui-song-title__editor" }, [input, done, hint]);
  const root = element("div", { className: "ui-song-title" }, [heading, description, editor]);
  const render = (): void => {
    const label = songTitleLabel(title);
    const isEditing = draft !== null;
    root.dataset["editing"] = String(isEditing);
    rename.hidden = isEditing || !label.isRenamable;
    plain.hidden = isEditing || label.isRenamable;
    hidden.hidden = !isEditing;
    editor.hidden = !isEditing;
    // The h1 holds the title once: in the button, or the hidden span; with no project, "Untzel".
    setText(text, label.isRenamable && !isEditing ? label.text : "");
    setText(hidden, isEditing ? label.text : "");
    setText(plain, plain.hidden ? "" : strings.brand);
    setAttributes(rename, { title: label.text });
  };
  const close = (refocus: boolean): void => {
    draft = null;
    render();
    options.onEditing(false);
    if (refocus) rename.focus({ preventScroll: true });
  };
  const commit = (isLeaving: boolean): void => {
    if (draft === null || title === null) return;
    const decision = commitTitleDraft(draft, title);
    if (decision.kind === "write") {
      title = decision.title;
      options.onRename(decision.title);
    }
    const announcement = titleAnnouncement(decision);
    if (announcement !== null) options.announce(announcement);
    close(!isLeaving);
  };
  const edit = (): void => {
    if (title === null) return;
    draft = title;
    render();
    options.onEditing(true);
    startEditing(input, title);
  };
  rename.addEventListener("click", edit);
  input.addEventListener("input", () => {
    const clamped = clampTitleDraft(input.value);
    if (clamped !== input.value) {
      input.value = clamped;
      input.setSelectionRange(clamped.length, clamped.length);
    }
    draft = clamped;
  });
  // While editing, Space, H and the other shortcuts type (the shell ignores keys in text).
  // Done is inside the editor: moving to it is not leaving.
  bindRenameField(input, done, commit, () => close(true));
  render();
  return {
    root,
    update(next) {
      // A title edited elsewhere (Code, undo) waits until the field closes.
      if (draft !== null && next === null) close(false);
      if (draft === null) title = next;
      render();
    },
    isEditing: () => draft !== null,
    edit,
  };
}
