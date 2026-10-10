// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setText } from "../dom";
import { icon } from "../icons";
import { bindings, readLabel, text, type Label } from "../../copy/copy";
import type { OfferToast } from "../../behavior/feedback/undo-offer";
import { ToastTimer } from "./toast-timer";

// A short message with one action ("ride deleted · Undo"). It
// stays a few seconds and waits while a pointer or the focus is on it (toast-timer.ts).
// It is no live region: the shell's polite status already speaks the same news, and the
// action is also Mod+Z on a keyboard. The message, the action and the name of × are bound
// once to what shows now, so a language switch while it shows rewrites them like the rest
// of the page.

/** Long enough to read the message and reach the button. */
export const TOAST_MS = 6_000;
/** A deleted project can be brought back for 10 s. */
export const PROJECT_TOAST_MS = 10_000;

export interface Toast extends OfferToast {
  readonly root: HTMLElement;
  /** A message alone ("Undid: gain on hat", "Midnight Coast is back"), with × only. */
  note(news: Label, durationMs?: number): void;
  hide(): void;
  /** Moves the keyboard to the action, when one shows; the toast then waits for it. */
  focusAction(): void;
}

/** `onFocusLost` takes the focus when the toast hides with the focus inside it. */
// Over 40 lines: one toast and its timer; show, note and hide share them.
export function createToast(onFocusLost: () => void): Toast {
  const message = element("p", { className: "ui-toast__message" });
  const action = element("button", { className: "ui-toast__action", attributes: { type: "button" } });
  const dismiss = button("ui-toast__close", text.dismissToast, () => hide(), [icon("close")]);
  const root = element("div", { className: "ui-toast", attributes: { hidden: true } }, [message, action, dismiss]);
  let shownMessage: Label = "";
  let shownAction: Label = "";
  bindings.text(message, () => readLabel(shownMessage));
  bindings.text(action, () => readLabel(shownAction));
  let onAction: () => void = () => undefined;
  const clock = {
    set: (run: () => void, ms: number): (() => void) => {
      const id = window.setTimeout(run, ms);
      return () => window.clearTimeout(id);
    },
  };
  const timer = new ToastTimer(clock, () => hide());

  const hide = (): void => {
    timer.stop();
    const hadFocus = root.contains(document.activeElement);
    root.hidden = true;
    if (hadFocus) onFocusLost();
  };
  const open = (news: Label, durationMs: number): void => {
    shownMessage = news;
    setText(message, readLabel(news));
    root.hidden = false;
    timer.start(durationMs);
  };
  action.addEventListener("click", () => onAction());
  root.addEventListener("pointerenter", () => timer.hold(true));
  root.addEventListener("pointerleave", () => timer.hold(false));
  root.addEventListener("focusin", () => timer.hold(true));
  root.addEventListener("focusout", (event) => {
    if (!root.contains(event.relatedTarget as Node | null)) timer.hold(false);
  });

  return {
    root,
    show(news, label, run, durationMs = TOAST_MS) {
      shownAction = label;
      setText(action, readLabel(label));
      action.hidden = false;
      onAction = run;
      open(news, durationMs);
    },
    note(news, durationMs = TOAST_MS) {
      action.hidden = true;
      onAction = () => undefined;
      open(news, durationMs);
    },
    hide,
    focusAction() {
      if (!root.hidden && !action.hidden) action.focus({ preventScroll: true });
    },
  };
}
