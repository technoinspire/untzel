// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Drag down to close a bottom sheet, as a
// pure state machine: the sheet follows the finger, closes past CLOSE_FRACTION of its
// height or on a downward flick, and snaps back otherwise.

/** Movement before a press becomes a drag, in CSS pixels. */
export const SHEET_DRAG_SLOP_PX = 8;
/** Released past this fraction of the sheet's height, the sheet closes. */
export const CLOSE_FRACTION = 0.3;
/** Released while moving down at least this fast, the sheet closes (a flick). */
export const FLICK_PX_PER_MS = 0.5;
/** Only the movement of the last VELOCITY_WINDOW_MS before release counts as a flick. */
export const VELOCITY_WINDOW_MS = 100;

export type SheetDragEnd = "close" | "snap-back" | "none";

interface Sample {
  readonly y: number;
  readonly time: number;
}

export class SheetDrag {
  #isPressed = false;
  #isDragging = false;
  #startY = 0;
  #height = 1;
  #samples: Sample[] = [];

  get isDragging(): boolean {
    return this.#isDragging;
  }

  down(y: number, time: number, height: number): void {
    this.#isPressed = true;
    this.#isDragging = false;
    this.#startY = y;
    this.#height = Math.max(1, height);
    this.#samples = [{ y, time }];
  }

  /** The sheet's downward offset while dragging, or null before the drag starts. */
  move(y: number, time: number): number | null {
    if (!this.#isPressed) return null;
    this.#record(y, time);
    if (!this.#isDragging && y - this.#startY > SHEET_DRAG_SLOP_PX) this.#isDragging = true;
    return this.#isDragging ? this.#offset(y) : null;
  }

  up(y: number, time: number): SheetDragEnd {
    if (!this.#isPressed) return "none";
    this.#record(y, time);
    const wasDragging = this.#isDragging;
    const isPastThreshold = this.#offset(y) >= this.#height * CLOSE_FRACTION;
    const isFlick = this.#velocity(time) >= FLICK_PX_PER_MS;
    this.#reset();
    if (!wasDragging) return "none";
    return isPastThreshold || isFlick ? "close" : "snap-back";
  }

  cancel(): SheetDragEnd {
    const wasDragging = this.#isDragging;
    this.#reset();
    return wasDragging ? "snap-back" : "none";
  }

  #offset(y: number): number {
    return Math.max(0, y - this.#startY);
  }

  #record(y: number, time: number): void {
    this.#samples.push({ y, time });
    this.#samples = this.#samples.filter((sample) => time - sample.time <= VELOCITY_WINDOW_MS);
  }

  /** Downward speed over the window, in px/ms; 0 for a finger that stopped before lifting. */
  #velocity(time: number): number {
    const first = this.#samples[0];
    const last = this.#samples[this.#samples.length - 1];
    if (first === undefined || last === undefined || last.time - first.time <= 0) return 0;
    return (last.y - first.y) / (last.time - first.time);
  }

  #reset(): void {
    this.#isPressed = false;
    this.#isDragging = false;
    this.#samples = [];
  }
}
