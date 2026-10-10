// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InfoLine, Proposal } from "@untzel/commands";
import { strings, text } from "../copy/copy";
import { button, el, uniqueId } from "./dom";
import { promptGlyph, tickIcon } from "./icons";

// The scrollback: one group of rows per command, no cards.
// The echo of the command, then its result, indented under it.

/** Room kept above a preview's header when it scrolls into view. */
const PREVIEW_MARGIN_PX = 4;
/** A diff never shrinks below two rows to make room. */
const MIN_DIFF_PX = 46;

export interface AppliedRow {
  /** "on the next bar" -> "playing since bar 23". */
  setDetail(text: string): void;
}

export interface PreviewRow {
  focusApply(): void;
  /** Takes the buttons away and leaves a line in their place. */
  close(text: string): void;
}

export interface ResultGroup {
  info(lines: readonly InfoLine[]): void;
  error(message: string, suggestion: string | null, onUse: (line: string) => void): void;
  applied(summary: string, detail: string): AppliedRow;
  preview(proposal: Proposal, actions: { apply: () => void; cancel: () => void }): PreviewRow;
}

function emptyState(): HTMLElement {
  return el(
    "div",
    "ut-empty",
    undefined,
    el("p", "ut-row ut-row--title", undefined, promptGlyph("ut-glyph ut-glyph--muted"), el("span", "", text.emptyTitle)),
    el("p", "ut-row ut-row--muted ut-row--indent", text.emptyKeys),
    el("p", "ut-row ut-row--muted ut-row--indent", text.emptyChoose),
    el("p", "ut-row ut-row--muted ut-row--indent", text.emptyBar),
  );
}

function diffRow(line: Proposal["diff"][number]): HTMLElement {
  const added = line.kind === "added";
  const row = el(
    "p",
    `ut-diff__line ut-diff__line--${line.kind}`,
    undefined,
    el("span", "ut-diff__number", String(line.line)),
    el("span", "ut-diff__sign", added ? "+" : "-"),
    el(added ? "ins" : "del", "ut-diff__text", line.text === "" ? " " : line.text),
  );
  return row;
}

export class ResultsLog {
  readonly root: HTMLElement;
  /**
   * The help, shown while the log is empty. It lives beside the log, never in it: the live
   * region carries results only, and the field reads the help as
   * its description, shown or not.
   */
  readonly help = emptyState();

  constructor(labelId: string) {
    this.root = el("div", "ut-log");
    this.root.setAttribute("role", "log");
    this.root.setAttribute("aria-live", "polite");
    this.root.setAttribute("aria-labelledby", labelId);
    this.root.tabIndex = 0;
    this.help.id = uniqueId("ut-help");
  }

  clear(): void {
    this.root.replaceChildren();
    this.help.hidden = false;
  }

  /** A new group that starts with the command as typed. */
  group(line: string): ResultGroup {
    this.help.hidden = true;
    const body = el("div", "ut-group__body");
    const group = el("div", "ut-group", undefined, el("p", "ut-echo", undefined, promptGlyph("ut-glyph ut-glyph--muted"), el("code", "ut-echo__line", line)), body);
    this.root.append(group);
    const reveal = (): void => {
      this.root.scrollTop = this.root.scrollHeight;
    };
    reveal();
    return {
      info: (lines) => {
        body.append(...lines.map((line) => el(line.code === true ? "code" : "p", line.code === true ? "ut-row ut-row--code" : "ut-row", line.text)));
        reveal();
      },
      error: (message, suggestion, onUse) => {
        group.classList.add("ut-group--error");
        body.append(el("p", "ut-row", message));
        if (suggestion !== null) {
          body.append(el("p", "ut-row ut-row--muted ut-row--small", strings.didYouMean));
          body.append(button("ut-chip ut-chip--suggestion", suggestion, () => onUse(suggestion)));
        }
        reveal();
      },
      applied: (summary, detail) => {
        const detailRow = el("span", "ut-applied__detail", detail);
        body.append(el("p", "ut-applied", undefined, tickIcon(), el("span", "ut-applied__summary", summary), detailRow));
        reveal();
        return { setDetail: (text) => (detailRow.textContent = text) };
      },
      preview: (proposal, actions) => this.#preview(group, body, proposal, actions, reveal),
    };
  }

  #preview(group: HTMLElement, body: HTMLElement, proposal: Proposal, actions: { apply: () => void; cancel: () => void }, reveal: () => void): PreviewRow {
    const removed = proposal.diff.filter((line) => line.kind === "removed").length;
    const count = Math.max(removed, proposal.diff.length - removed);
    const title = el("p", "ut-preview__title", strings.previewTitle(proposal.title, count));
    // The header names the command, so it takes the echo's place.
    group.querySelector(".ut-echo")?.remove();
    const diff = el("div", "ut-diff", undefined, ...proposal.diff.map(diffRow));
    const apply = button("ut-action ut-action--apply", strings.apply, actions.apply);
    const cancel = button("ut-action ut-action--cancel", strings.cancel, actions.cancel);
    const buttons = el("div", "ut-preview__actions", undefined, apply, cancel);
    const note = el("p", "ut-row ut-row--muted ut-row--small", strings.previewNote);
    // Open: the pane grows to hold it (styles/code-area.css) while the diff stays in view.
    const block = el("div", "ut-preview ut-preview--open", undefined, title, diff, note, buttons);
    block.setAttribute("role", "group");
    block.setAttribute("aria-label", title.textContent ?? "");
    // The focus sits on Apply, away from the field: Esc and Mod+Enter work from here too.
    block.addEventListener("keydown", (event) => {
      const isApply = event.key === "Enter" && (event.metaKey || event.ctrlKey);
      if (event.key !== "Escape" && !isApply) return;
      event.preventDefault();
      event.stopPropagation();
      if (isApply) actions.apply();
      else actions.cancel();
    });
    body.append(block);
    this.#fitDiff(block, diff);
    this.#revealTop(block);
    return {
      focusApply: () => apply.focus({ preventScroll: true }),
      close: (text) => {
        block.classList.remove("ut-preview--open");
        buttons.remove();
        note.textContent = text;
        reveal();
      },
    };
  }

  /** Header, diff and buttons in the log at once: a diff taller than the room scrolls. */
  #fitDiff(block: HTMLElement, diff: HTMLElement): void {
    const padding = Number.parseFloat(getComputedStyle(this.root).paddingBottom) || 0;
    const spare = this.root.clientHeight - padding - PREVIEW_MARGIN_PX - block.offsetHeight;
    if (spare < 0) diff.style.maxHeight = `${Math.max(MIN_DIFF_PX, diff.clientHeight + spare)}px`;
    // A diff that scrolls on its own takes keyboard focus, so the keys scroll it too.
    if (diff.scrollHeight > diff.clientHeight) diff.tabIndex = 0;
  }

  /** A preview is what the person confirms: its header first, not the log's bottom. */
  #revealTop(block: HTMLElement): void {
    const offset = block.getBoundingClientRect().top - this.root.getBoundingClientRect().top;
    this.root.scrollTop += offset - PREVIEW_MARGIN_PX;
  }
}
