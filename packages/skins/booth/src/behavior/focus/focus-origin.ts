// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Whether the focused control got its focus from a pointer: after a
// click on Mute or Song, Space must play and pause, not press that button again. A key
// that moves focus (Tab, the arrows, Esc, Enter) hands Space back to the control.
// `:focus-visible` cannot tell: Chrome turns it on with the first key pressed.
// A closure with one listener, not a class: it sits in the initial JS (68 KB budget).
const MOVES_FOCUS = /^(Tab|Escape|Enter|Arrow\w+|Home|End)$/;

export interface FocusOrigin {
  readonly isPointer: () => boolean;
  readonly detach: () => void;
}

/** Listens on `target` before the shortcuts do (capture). */
export function trackFocusOrigin(target: EventTarget): FocusOrigin {
  let isPointer = false;
  const onEvent = (event: Event): void => {
    if (event.type === "pointerdown") isPointer = true;
    else if (MOVES_FOCUS.test((event as KeyboardEvent).key)) isPointer = false;
  };
  const listening = new AbortController();
  for (const type of ["pointerdown", "keydown"]) target.addEventListener(type, onEvent, { capture: true, signal: listening.signal });
  return { isPointer: () => isPointer, detach: () => listening.abort() };
}
