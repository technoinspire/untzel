// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The music's changes draw once per frame, and a view reads its last model to
// answer an input: two arrow presses inside one frame would both start from the same bar.
// So every discrete input draws what is pending first, in the capture phase, before any
// handler of the page runs. The result still paints on the same frame as before.
// Not "input" or "change": by then the control already holds the user's new value, and a
// draw would write the model's old value back into it (a <select>) before the view's
// handler reads it. Measured: 6 to 8 of 20 Bars picks lost while the music played. The
// keydown or pointerdown that started the pick has already drawn.
const INPUTS = ["keydown", "keyup", "pointerdown", "pointerup", "click"] as const;

export function drawBeforeInput(target: Pick<Window, "addEventListener">, draw: () => void): void {
  for (const type of INPUTS) target.addEventListener(type, draw, { capture: true });
}
