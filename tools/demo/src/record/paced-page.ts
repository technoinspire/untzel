// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The page the gestures get while recording: the same calls as Playwright's, at a person's
// pace on the video's frames. Before a press the visible cursor travels to the control
// (gesture-schedule.ts); code is typed one key per few frames; and a control that is not on
// screen yet (a sheet still opening, a bar still to come) is waited for frame by frame, so
// the video shows the wait instead of the page jumping.
import type { Locator, Page } from "@playwright/test";
import type { BrowserSession } from "./browser-session";
import type { GestureKeyboard, GestureLocator, GesturePage, GestureRole, RoleQuery } from "./gesture-page";
import { FPS } from "./frame-time";
import { burstWaitFrames, cursorPath, keyFrames, travelFrames } from "./gesture-schedule";

/** About 3 s: longer than any sheet takes to open or a change to reach the next bar. */
export const MAX_WAIT_FRAMES = 90;

/** The finger stays down on the control for a frame, so the tap ring is seen where it pressed. */
const TAP_FRAMES = 1;

/** Code typing speeds of the demo, in characters a second. */
export interface TypingSpeeds {
  readonly keys: number;
  readonly bursts: number;
}

interface Pace {
  readonly session: BrowserSession;
  readonly page: Page;
  readonly speeds: TypingSpeeds;
}

function query(options: RoleQuery | undefined): Parameters<Page["getByRole"]>[1] {
  if (options === undefined) return {};
  return { ...(options.name === undefined ? {} : { name: options.name }), ...(options.exact === undefined ? {} : { exact: options.exact }) };
}

/** Where the caret of the focused field is: an offset into its text (a line's breaks not counted). */
function caretOffset(page: Page): Promise<number> {
  return page.evaluate(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) return focused.selectionStart ?? -1;
    const selection = getSelection();
    if (focused === null || selection === null || selection.rangeCount === 0 || selection.anchorNode === null) return -1;
    const range = document.createRange();
    range.setStart(focused, 0);
    range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().length;
  });
}

/**
 * Types `text` into the focus, a key per few frames. In the Code panel a sounding token
 * redrawn on the line at the instant of a key can leave the caret before the character
 * just typed, which would put the next one before it; a person sees that and presses →.
 */
async function typeKeys(pace: Pace, text: string): Promise<void> {
  const waits = keyFrames(text, pace.speeds.keys);
  for (const [index, key] of [...text].entries()) {
    await pace.session.advance(waits[index] ?? 1);
    if (key === "\n") {
      await pace.page.keyboard.press("Enter");
      continue;
    }
    const before = await caretOffset(pace.page);
    await pace.page.keyboard.press(key === " " ? "Space" : key);
    if (before >= 0 && (await caretOffset(pace.page)) === before) await pace.page.keyboard.press("ArrowRight");
  }
}

/**
 * One burst of typed code, after the frames its characters take at the burst speed. The
 * same redraw can leave the caret inside or before a burst; a person sees it and moves it
 * back to the burst's end.
 */
async function typeBurst(pace: Pace, text: string): Promise<void> {
  await pace.session.advance(burstWaitFrames(text.length, pace.speeds.bursts));
  const before = await caretOffset(pace.page);
  await pace.page.keyboard.insertText(text);
  if (before < 0) return;
  const missing = before + text.length - (await caretOffset(pace.page));
  for (let step = 0; step < Math.abs(missing); step += 1) await pace.page.keyboard.press(missing > 0 ? "ArrowRight" : "ArrowLeft");
}

class PacedLocator implements GestureLocator {
  readonly #locator: Locator;
  readonly #pace: Pace;
  constructor(locator: Locator, pace: Pace) {
    this.#locator = locator;
    this.#pace = pace;
  }

  getByRole(role: GestureRole, options?: RoleQuery): GestureLocator {
    return new PacedLocator(this.#locator.getByRole(role, query(options)), this.#pace);
  }

  first(): GestureLocator {
    return new PacedLocator(this.#locator.first(), this.#pace);
  }

  last(): GestureLocator {
    return new PacedLocator(this.#locator.last(), this.#pace);
  }

  async click(): Promise<void> {
    await this.#reach();
    await this.#locator.click();
    await this.#pace.session.advance(TAP_FRAMES);
  }

  async dblclick(): Promise<void> {
    await this.#reach();
    await this.#locator.dblclick();
    await this.#pace.session.advance(TAP_FRAMES);
  }

  async focus(): Promise<void> {
    await this.#waitShown();
    await this.#locator.focus();
  }

  async fill(value: string): Promise<void> {
    await this.#reach();
    await this.#locator.fill(value);
    await this.#pace.session.advance(TAP_FRAMES);
  }

  async press(key: string): Promise<void> {
    await this.#waitShown();
    await this.#locator.press(key);
  }

  async pressSequentially(text: string): Promise<void> {
    // Focused once, then the keys go to the focus: no click, which in the Code panel would
    // move the caret the keys just placed.
    await this.#reach();
    await this.#locator.focus();
    await typeKeys(this.#pace, text);
  }

  isVisible(): Promise<boolean> {
    return this.#locator.isVisible();
  }

  async waitFor(options: { readonly timeout: number }): Promise<void> {
    await this.#waitShown(Math.ceil((options.timeout * FPS) / 1000));
  }

  getAttribute(name: string): Promise<string | null> {
    return this.#locator.getAttribute(name);
  }

  /** Frames go by until the control is on screen. */
  async #waitShown(limit = MAX_WAIT_FRAMES): Promise<void> {
    for (let frame = 0; !(await this.#locator.isVisible()); frame += 1) {
      if (frame >= limit) throw new Error(`not on screen after ${limit} frames: ${this.#locator.toString()}`);
      await this.#pace.session.advance();
    }
  }

  /** The cursor travels to the control's centre, one position per frame. */
  async #reach(): Promise<void> {
    await this.#waitShown();
    await this.#locator.scrollIntoViewIfNeeded();
    const box = await this.#locator.boundingBox();
    if (box === null) return;
    const { session } = this.#pace;
    const target = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (const point of cursorPath(session.cursor, target, travelFrames(session.cursor, target))) {
      await session.moveCursor(point);
      await session.advance();
    }
  }
}

class PacedKeyboard implements GestureKeyboard {
  readonly #page: Page;
  readonly #pace: Pace;
  constructor(page: Page, pace: Pace) {
    this.#page = page;
    this.#pace = pace;
  }

  press(key: string): Promise<void> {
    return this.#page.keyboard.press(key);
  }

  type(text: string): Promise<void> {
    return typeKeys(this.#pace, text);
  }

  insertText(text: string): Promise<void> {
    return typeBurst(this.#pace, text);
  }
}

/** The gestures' page over a recording session. */
export class PacedPage implements GesturePage {
  readonly keyboard: GestureKeyboard;
  readonly #page: Page;
  readonly #pace: Pace;
  constructor(session: BrowserSession, speeds: TypingSpeeds) {
    this.#page = session.page;
    this.#pace = { session, page: session.page, speeds };
    this.keyboard = new PacedKeyboard(session.page, this.#pace);
  }

  getByRole(role: GestureRole, options?: RoleQuery): GestureLocator {
    return new PacedLocator(this.#page.getByRole(role, query(options)), this.#pace);
  }

  viewportSize(): { readonly width: number; readonly height: number } | null {
    return this.#page.viewportSize();
  }
}
