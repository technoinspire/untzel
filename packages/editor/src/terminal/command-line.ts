// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_LINE_LENGTH, STARTER_COMMANDS, type Completion, type LineCompletion } from "@untzel/commands";
import { text } from "../copy/copy";
import { button, el, labelAttribute, uniqueId } from "./dom";
import type { CommandHistory } from "./history";
import { promptGlyph, runIcon } from "./icons";

// The command line: a combobox with suggestion chips, the usage hint, the ghost text of
// the first match and the bar line above it.

const MAX_CHIPS = 12;

export interface CommandLineOptions {
  readonly history: CommandHistory;
  readonly complete: (line: string, cursor: number) => LineCompletion;
  readonly run: (line: string) => void;
  /** Esc with something to close (a preview): true when handled. */
  readonly escape: () => boolean;
  /** Mod+Enter: true when a preview was applied. */
  readonly applyShortcut: () => boolean;
  /** The terminal's help, outside the live log: read with the usage hint. */
  readonly helpId: string;
}

export class CommandLine {
  readonly root: HTMLElement;
  readonly input: HTMLInputElement;
  readonly #options: CommandLineOptions;
  readonly #chips: HTMLElement;
  readonly #hint: HTMLElement;
  readonly #typed: HTMLElement;
  readonly #ghost: HTMLElement;
  readonly #beat: HTMLElement;
  #completion: LineCompletion = { from: 0, to: 0, options: [], hint: null, ghost: "" };
  #active = 0;
  /** Esc hid the list until the next keystroke. */
  #suppressed = false;
  /** A preview owns the space: no chips while Apply and Cancel are on screen. */
  #held = false;

  // Over 40 lines: the combobox's parts built and linked by their ids, in the order they sit.
  constructor(options: CommandLineOptions) {
    this.#options = options;
    const listId = uniqueId("ut-chips");
    const hintId = uniqueId("ut-hint");
    this.input = el("input", "ut-field__input");
    this.input.type = "text";
    this.input.id = uniqueId("ut-command");
    this.input.maxLength = MAX_LINE_LENGTH;
    labelAttribute(this.input, "placeholder", text.placeholder);
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.enterKeyHint = "send";
    for (const [name, value] of Object.entries({
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": listId,
      "aria-describedby": `${hintId} ${options.helpId}`,
      autocapitalize: "off",
      autocorrect: "off",
    })) {
      this.input.setAttribute(name, value);
    }
    labelAttribute(this.input, "aria-label", text.commandLabel);
    this.#typed = el("span", "ut-field__typed");
    this.#ghost = el("span", "ut-field__ghost", undefined, this.#typed, el("span", "ut-field__rest"));
    this.#ghost.setAttribute("aria-hidden", "true");
    const field = el("div", "ut-field", undefined, this.#ghost, this.input);
    const run = button("ut-run", text.run, () => this.#run(), runIcon());
    const prompt = el("div", "ut-prompt", undefined, promptGlyph("ut-glyph ut-glyph--prompt"), field, run);
    this.#chips = el("div", "ut-chips");
    this.#chips.id = listId;
    this.#chips.setAttribute("role", "listbox");
    labelAttribute(this.#chips, "aria-label", text.suggestions);
    this.#hint = el("p", "ut-hint");
    this.#hint.id = hintId;
    this.#beat = el("div", "ut-beat");
    this.#beat.setAttribute("aria-hidden", "true");
    this.root = el("div", "ut-bottom", undefined, this.#beat, this.#hint, this.#chips, prompt);
    this.input.addEventListener("input", () => {
      this.#suppressed = false;
      this.refresh();
    });
    this.input.addEventListener("keydown", (event) => this.#onKey(event));
    this.input.addEventListener("click", () => this.refresh());
    this.refresh();
  }

  get value(): string {
    return this.input.value;
  }

  /** Puts a whole line in the field, the cursor at its end. */
  setValue(line: string, focus = true): void {
    this.input.value = line;
    this.input.setSelectionRange(line.length, line.length);
    this.#suppressed = false;
    if (focus) this.input.focus({ preventScroll: true });
    this.refresh();
  }

  /** Recomputes chips, hint and ghost text for the line and the cursor. */
  refresh(): void {
    const line = this.input.value;
    const cursor = this.input.selectionStart ?? line.length;
    this.#completion = this.#options.complete(line, cursor);
    this.#active = 0;
    const options: readonly Completion[] = this.#held
      ? []
      : line.trim() === ""
      ? STARTER_COMMANDS.map((label) => ({ label, detail: "" }))
      : this.#suppressed ? [] : this.#completion.options;
    this.#renderChips(options.slice(0, MAX_CHIPS));
    this.#hint.textContent = this.#completion.hint ?? "";
    // One line on screen; the whole hint on hover and in the field's description.
    this.#hint.title = this.#completion.hint ?? "";
    this.#hint.hidden = this.#completion.hint === null;
    const atEnd = cursor === line.length && !this.#suppressed;
    this.#typed.textContent = line;
    (this.#ghost.lastChild as HTMLElement).textContent = atEnd ? this.#completion.ghost : "";
  }

  /** Hides the chips while a preview is open, and brings them back after. */
  hold(held: boolean): void {
    this.#held = held;
    this.refresh();
  }

  /** The bar line lights when an applied command enters on the bar. */
  pulse(reducedMotion: boolean): void {
    this.#beat.classList.remove("ut-beat--lit", "ut-beat--pulse");
    // Restart the animation on a repeat.
    void this.#beat.offsetWidth;
    this.#beat.classList.add(reducedMotion ? "ut-beat--lit" : "ut-beat--pulse");
  }

  /** After a bar with the light on, the reduced-motion state goes back to rest. */
  rest(): void {
    this.#beat.classList.remove("ut-beat--lit");
  }

  #renderChips(options: readonly Completion[]): void {
    const chips = options.map((option, index) => {
      const chip = button("ut-chip", option.label, () => this.#accept(option));
      chip.id = `${this.#chips.id}-${index}`;
      chip.tabIndex = -1;
      chip.setAttribute("role", "option");
      chip.setAttribute("aria-selected", String(index === this.#active));
      if (option.detail !== "") chip.title = option.detail;
      // Keep the focus (and the phone keyboard) in the field.
      chip.addEventListener("pointerdown", (event) => event.preventDefault());
      return chip;
    });
    this.#chips.replaceChildren(...chips);
    this.#chips.hidden = chips.length === 0;
    this.input.setAttribute("aria-expanded", String(chips.length > 0));
    this.#markActive();
  }

  #markActive(): void {
    const chips = [...this.#chips.children] as HTMLElement[];
    chips.forEach((chip, index) => {
      const active = index === this.#active;
      chip.setAttribute("aria-selected", String(active));
      chip.classList.toggle("ut-chip--active", active && this.input.value.trim() !== "");
    });
    const active = chips[this.#active];
    if (active === undefined || this.input.value.trim() === "") this.input.removeAttribute("aria-activedescendant");
    else this.input.setAttribute("aria-activedescendant", active.id);
  }

  /** A chosen word replaces the one under the cursor, followed by a blank. */
  #accept(option: Completion): void {
    const line = this.input.value;
    const { from, to } = line.trim() === "" ? { from: 0, to: line.length } : this.#completion;
    const head = `${line.slice(0, from)}${option.label} `;
    this.input.value = `${head}${line.slice(to).trimStart()}`;
    this.input.setSelectionRange(head.length, head.length);
    this.input.focus({ preventScroll: true });
    this.refresh();
  }

  #run(): void {
    const line = this.input.value;
    if (line.trim() === "") return;
    this.#options.history.push(line);
    this.input.value = "";
    this.refresh();
    this.#options.run(line);
  }

  /** Moves the active suggestion; false when it would pass an end and must not wrap. */
  #moveActive(step: 1 | -1, count: number, wrap: boolean): boolean {
    const next = this.#active + step;
    if (!wrap && (next < 0 || next >= count)) return false;
    this.#active = (next + count) % count;
    this.#markActive();
    return true;
  }

  #onKey(event: KeyboardEvent): void {
    const handled = this.#handleKey(event);
    if (!handled) return;
    event.preventDefault();
    event.stopPropagation();
  }

  // Over 40 lines: one case per key of the combobox.
  #handleKey(event: KeyboardEvent): boolean {
    const options = [...this.#chips.children] as HTMLElement[];
    const hasOptions = !this.#chips.hidden && options.length > 0;
    switch (event.key) {
      case "Enter":
        if ((event.metaKey || event.ctrlKey) && this.#options.applyShortcut()) return true;
        this.#run();
        return true;
      case "Tab": {
        // An empty field lets Tab leave: the starter chips are for tapping, not a trap.
        if (!hasOptions || this.input.value.trim() === "") return false;
        // Shift+Tab walks back; on the first suggestion it leaves the field.
        if (event.shiftKey) return this.#moveActive(-1, options.length, false);
        const chosen = options[this.#active]?.textContent ?? "";
        const option = this.#completion.options.find((entry) => entry.label === chosen) ?? { label: chosen, detail: "" };
        this.#accept(option);
        return true;
      }
      case "ArrowUp":
      case "ArrowDown": {
        // Alt+Up / Alt+Down choose among the suggestions; plain Up / Down are the history.
        if (event.altKey) return hasOptions && this.input.value.trim() !== "" && this.#moveActive(event.key === "ArrowDown" ? 1 : -1, options.length, true);
        const line = event.key === "ArrowUp" ? this.#options.history.previous(this.input.value) : this.#options.history.next();
        if (line !== null) this.setValue(line);
        return true;
      }
      case "Escape":
        if (this.#options.escape()) return true;
        if (hasOptions && this.input.value.trim() !== "") {
          this.#suppressed = true;
          this.refresh();
          return true;
        }
        if (this.input.value !== "") {
          this.setValue("");
          return true;
        }
        return false;
      default:
        return false;
    }
  }
}
