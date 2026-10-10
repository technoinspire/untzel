// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// A GesturePage for the tests: it finds nothing and presses nothing, it writes down every
// call with the roles and names that led to it, in order. Every control shows, and every
// attribute is absent, unless the test says otherwise.
import type { GestureKeyboard, GestureLocator, GesturePage, GestureRole, RoleQuery } from "./gesture-page";

/** One step of a locator: the role and the accessible name it was found by. */
export interface FoundBy {
  readonly role: GestureRole;
  readonly name: string | null;
}

export interface FakeCall {
  /** The locator the call was made on, from the page down; empty for the keyboard. */
  readonly path: readonly FoundBy[];
  readonly method: string;
  readonly argument: string | null;
}

export interface FakePageOptions {
  /** Whether a control shows; every control does by default. */
  readonly isVisible?: (path: readonly FoundBy[]) => boolean;
  readonly attribute?: (path: readonly FoundBy[], name: string) => string | null;
  readonly viewport?: { readonly width: number; readonly height: number };
}

function nameOf(query: RoleQuery | undefined): string | null {
  const name = query?.name;
  if (name === undefined) return null;
  return typeof name === "string" ? name : name.source;
}

class FakeLocator implements GestureLocator {
  readonly #page: FakePage;
  readonly #path: readonly FoundBy[];

  constructor(page: FakePage, path: readonly FoundBy[]) {
    this.#page = page;
    this.#path = path;
  }

  getByRole(role: GestureRole, query?: RoleQuery): GestureLocator {
    return new FakeLocator(this.#page, [...this.#path, { role, name: nameOf(query) }]);
  }

  first(): GestureLocator {
    return this;
  }

  last(): GestureLocator {
    return this;
  }

  click(): Promise<void> {
    return this.#record("click");
  }

  dblclick(): Promise<void> {
    return this.#record("dblclick");
  }

  focus(): Promise<void> {
    return this.#record("focus");
  }

  fill(value: string): Promise<void> {
    return this.#record("fill", value);
  }

  press(key: string): Promise<void> {
    return this.#record("press", key);
  }

  pressSequentially(text: string): Promise<void> {
    return this.#record("pressSequentially", text);
  }

  isVisible(): Promise<boolean> {
    return Promise.resolve(this.#page.options.isVisible?.(this.#path) ?? true);
  }

  async waitFor(): Promise<void> {
    if (!(await this.isVisible())) throw new Error(`not on screen: ${this.#path.map((step) => step.name).join(" › ")}`);
  }

  getAttribute(name: string): Promise<string | null> {
    return Promise.resolve(this.#page.options.attribute?.(this.#path, name) ?? null);
  }

  #record(method: string, argument: string | null = null): Promise<void> {
    this.#page.calls.push({ path: this.#path, method, argument });
    return Promise.resolve();
  }
}

export class FakePage implements GesturePage {
  readonly calls: FakeCall[] = [];
  readonly options: FakePageOptions;
  readonly keyboard: GestureKeyboard;

  constructor(options: FakePageOptions = {}) {
    this.options = options;
    const record = (method: string, argument: string): Promise<void> => {
      this.calls.push({ path: [], method, argument });
      return Promise.resolve();
    };
    this.keyboard = {
      press: (key) => record("keyboard.press", key),
      type: (text) => record("keyboard.type", text),
      insertText: (text) => record("keyboard.insertText", text),
    };
  }

  getByRole(role: GestureRole, query?: RoleQuery): GestureLocator {
    return new FakeLocator(this, [{ role, name: nameOf(query) }]);
  }

  viewportSize(): { readonly width: number; readonly height: number } | null {
    return this.options.viewport ?? { width: 1440, height: 810 };
  }

  /** The calls as "method role:name › role:name (argument)", for readable expectations. */
  lines(): string[] {
    return this.calls.map((call) => {
      const path = call.path.map((step) => `${step.role}:${step.name ?? "*"}`).join(" › ");
      return `${call.method}${path === "" ? "" : ` ${path}`}${call.argument === null ? "" : ` (${call.argument})`}`;
    });
  }
}
