// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What a gesture uses of Playwright: controls found by
// their role and accessible name, as a person and a screen reader find them, then pressed,
// typed into or filled. Playwright's Page satisfies this by structure; the recorder hands
// the gestures a paced page that moves a visible cursor and the virtual clock between the
// calls, and the tests a FakePage that records them.
import type { InstrumentRegistry } from "@untzel/core";
import type { DemoAction } from "../actions";

export type GestureRole =
  | "button"
  | "combobox"
  | "complementary"
  | "dialog"
  | "grid"
  | "gridcell"
  | "group"
  | "list"
  | "navigation"
  | "region"
  | "row"
  | "slider"
  | "switch"
  | "table"
  | "textbox";

export interface RoleQuery {
  readonly name?: string | RegExp;
  readonly exact?: boolean;
}

export interface GestureLocator {
  getByRole(role: GestureRole, query?: RoleQuery): GestureLocator;
  first(): GestureLocator;
  last(): GestureLocator;
  click(): Promise<void>;
  dblclick(): Promise<void>;
  focus(): Promise<void>;
  /** Sets a field's or a range slider's value, with the input events a person's change sends. */
  fill(value: string): Promise<void>;
  press(key: string): Promise<void>;
  /** Types key by key. */
  pressSequentially(text: string): Promise<void>;
  /** Right now, without waiting. */
  isVisible(): Promise<boolean>;
  /** Waits until it shows; rejects after `timeout` milliseconds of the page's time. */
  waitFor(options: { readonly timeout: number }): Promise<void>;
  getAttribute(name: string): Promise<string | null>;
}

export interface GestureKeyboard {
  press(key: string): Promise<void>;
  /** Types key by key into what has the focus. */
  type(text: string): Promise<void>;
  /** Puts `text` at the focus in one go: one burst of a few words, readable on screen. */
  insertText(text: string): Promise<void>;
}

export interface GesturePage {
  getByRole(role: GestureRole, query?: RoleQuery): GestureLocator;
  readonly keyboard: GestureKeyboard;
  viewportSize(): { readonly width: number; readonly height: number } | null;
}

/** What a gesture knows besides its action. */
export interface GestureContext {
  /** The text as the script has it right before this action. */
  readonly source: string;
  readonly registry: InstrumentRegistry;
  /** The phone layout (Story): tabs, bottom sheets, Adjust buttons. */
  readonly isPhone: boolean;
}

/** How one kind of action is done in the interface. */
export type Gesture<Action extends DemoAction = DemoAction> = (page: GesturePage, action: Action, context: GestureContext) => Promise<void>;

/** One gesture for every action kind: a new kind without a gesture does not compile. */
export type Gestures = { readonly [Kind in DemoAction["kind"]]: Gesture<Extract<DemoAction, { readonly kind: Kind }>> };
