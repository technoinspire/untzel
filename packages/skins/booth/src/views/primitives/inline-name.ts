// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";
import { text } from "../../copy/copy";
import { bindRenameField, startEditing } from "./rename-field";
import { commitOf, inlineNameModel, renamedAnnouncement, type InlineNameKind, type InlineNameModel } from "./inline-name-model";

// The one editable name: idle, the name is a 44 px button with a
// pencil; editing, a labelled field with Cancel and the rule underneath, which an error
// replaces in place. Tap or Enter edits, Enter or leaving applies, Esc or Cancel gives up.
// Dumb: inline-name-model.ts validates and words everything; the field only keeps the draft.

export interface InlineNameOptions {
  readonly kind: InlineNameKind;
  /** Unique per instance: ties the field to its rule. */
  readonly id: string;
  readonly onRename: (name: string) => void;
  readonly announce: (message: string) => void;
}

export interface InlineName {
  readonly root: HTMLElement;
  /** The idle button's hidden description ("Rename track"): goes next to, not inside, the heading. */
  readonly description: HTMLElement;
  /** `taken`: the other names of the same kind. */
  update(value: string, taken: ReadonlySet<string>): void;
  isEditing(): boolean;
  /** Starts editing (the table's double click). */
  edit(): void;
}

/**
 * Over 40 lines: the draft, the written name and the taken names are gesture state that
 * render, commit, close and the field's handlers share, so they live in this one closure.
 * Validation and every word come from inline-name-model.ts, tested without the DOM.
 */
export function createInlineName(options: InlineNameOptions): InlineName {
  let value = "";
  let taken: ReadonlySet<string> = new Set();
  let draft: string | null = null;
  const ruleId = `${options.id}-rule`;
  const descriptionId = `${options.id}-description`;
  const label = element("span", { className: "ui-inline-name__text" });
  const idle = element("button", { className: "ui-inline-name__button", attributes: { type: "button" } }, [label, icon("pencil")]);
  // Hidden: aria-describedby still reads it. Outside the root, so the heading the root
  // sits in holds the name alone.
  const description = element("span", { attributes: { id: descriptionId, hidden: true } });
  const input = element("input", {
    className: "ui-inline-name__field",
    attributes: { type: "text", id: `${options.id}-field`, enterkeyhint: "done", autocomplete: "off", spellcheck: "false", "aria-describedby": ruleId },
  });
  const cancel = button("ui-pill ui-pill--raised ui-inline-name__cancel", text.cancel, () => close(true));
  const rule = element("p", { className: "ui-inline-name__rule", attributes: { id: ruleId } });
  const editor = element("span", { className: "ui-inline-name__editor" }, [
    element("span", { className: "ui-inline-name__row" }, [input, cancel]),
    rule,
  ]);
  const root = element("span", { className: "ui-inline-name" }, [idle, editor]);

  const model = (): InlineNameModel => inlineNameModel(options.kind, value, draft, taken);
  const render = (): void => {
    const current = model();
    const isEditing = draft !== null;
    root.dataset["editing"] = String(isEditing);
    idle.hidden = isEditing;
    // Out of the tree while idle: the heading it sits in reads only the name.
    if (isEditing && !editor.isConnected) root.append(editor);
    if (!isEditing) editor.remove();
    setText(label, value);
    setAttributes(idle, { "aria-label": current.buttonLabel, "aria-describedby": current.buttonDescription === null ? null : descriptionId, title: value });
    setText(description, current.buttonDescription ?? "");
    setAttributes(input, { "aria-label": current.fieldLabel, "aria-invalid": current.error === null ? null : "true" });
    rule.classList.toggle("is-error", current.error !== null);
    rule.replaceChildren(...(current.error === null ? [] : [icon("alert")]), element("span", { text: current.error ?? current.rule }));
  };
  const close = (refocus: boolean): void => {
    draft = null;
    render();
    if (refocus) idle.focus({ preventScroll: true });
  };
  /** Enter applies or stays; leaving the field applies or keeps the old name, never silently. */
  const commit = (isLeaving: boolean): void => {
    if (draft === null) return;
    const decision = commitOf(model());
    if (decision.kind === "refuse" && !isLeaving) return;
    const announcement = renamedAnnouncement(decision, value);
    if (decision.kind === "write") {
      value = decision.name;
      options.onRename(decision.name);
    }
    if (announcement !== null) options.announce(announcement);
    close(!isLeaving);
  };
  const edit = (): void => {
    draft = value;
    render();
    startEditing(input, value);
  };

  idle.addEventListener("click", edit);
  input.addEventListener("input", () => {
    draft = input.value;
    render();
  });
  // Esc closes the field, not the sheet around it; Cancel is inside the editor: moving to it is not leaving.
  bindRenameField(input, cancel, commit, () => close(true));
  render();

  return {
    root,
    description,
    update(nextValue, nextTaken) {
      taken = nextTaken;
      if (draft === null) value = nextValue;
      render();
    },
    isEditing: () => draft !== null,
    edit,
  };
}
