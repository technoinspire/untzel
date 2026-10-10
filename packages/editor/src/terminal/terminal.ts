// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { CommandOutcome, Proposal, SessionAction } from "@untzel/commands";
import type { TerminalCommands, TerminalPort, TerminalState } from "../ports";
import { strings, text } from "../copy/copy";
import { CommandLine } from "./command-line";
import { el, uniqueId } from "./dom";
import { CommandHistory } from "./history";
import { liftAboveKeyboard } from "./keyboard-lift";
import { ResultsLog, type AppliedRow, type PreviewRow, type ResultGroup } from "./results";

// The composer terminal. Every line goes through
// the command layer; a change reaches the session only through port.apply, once, after
// a preview when one is due. The music never stops for a command.

export interface TerminalOptions {
  readonly port: TerminalPort;
  readonly commands: TerminalCommands;
}

export interface Terminal {
  readonly root: HTMLElement;
  focus(): void;
  destroy(): void;
}

/** A change applied while playing, waiting for the bar it enters on. */
interface Waiting {
  readonly row: AppliedRow;
  readonly bar: number;
}

interface OpenPreview {
  readonly line: string;
  readonly proposal: Proposal;
  readonly group: ResultGroup;
  readonly row: PreviewRow;
}

/** Why a session use case refused, in the current language. */
function failureText(code: string): string {
  switch (code) {
    case "NO_PROGRAM":
      return strings.failureNoProgram;
    case "NOT_IN_LOOP":
      return strings.failureNotInLoop;
    case "NOTHING_TO_UNDO":
      return strings.failureNothingToUndo;
    case "NOTHING_TO_REDO":
      return strings.failureNothingToRedo;
    case "SONG_UNAVAILABLE":
      return strings.failureSongUnavailable;
    case "UNKNOWN_TRACK":
      return strings.failureUnknownTrack;
    default:
      return strings.failed;
  }
}

/**
 * The page's one source: data-motion on the root, which the menu's Reduced
 * motion sets; the system's preference only where no page publishes it. Reading only the
 * system let the bar line pulse with the menu's switch on.
 */
function prefersReducedMotion(): boolean {
  const choice = typeof document === "undefined" ? undefined : document.documentElement.dataset["motion"];
  if (choice !== undefined) return choice === "reduced";
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class TerminalController {
  readonly #port: TerminalPort;
  readonly #commands: TerminalCommands;
  readonly log: ResultsLog;
  readonly line: CommandLine;
  #waiting: Waiting[] = [];
  #preview: OpenPreview | null = null;
  /** The bar the reduced-motion light came on; it rests on the next one. */
  #litBar: number | null = null;

  constructor(options: TerminalOptions, labelId: string) {
    this.#port = options.port;
    this.#commands = options.commands;
    this.log = new ResultsLog(labelId);
    this.line = new CommandLine({
      history: new CommandHistory(),
      complete: (line, cursor) => this.#commands.completeLine(line, cursor, this.#port.state().source),
      run: (line) => this.run(line),
      escape: () => this.#cancelPreview(),
      applyShortcut: () => this.#applyPreview(),
      helpId: this.log.help.id,
    });
  }

  run(line: string): void {
    this.#cancelPreview();
    this.#show(line, this.#commands.run(line, this.#port.state().source), this.log.group(line));
  }

  #show(line: string, outcome: CommandOutcome, group: ResultGroup): void {
    switch (outcome.kind) {
      case "empty":
        return;
      case "clear":
        this.#waiting = [];
        this.log.clear();
        return;
      case "info":
        group.info(outcome.lines);
        return;
      case "error":
        group.error(outcome.message, outcome.suggestion, (suggestion) => this.line.setValue(suggestion));
        return;
      case "action":
        this.#perform(outcome.action, group);
        return;
      case "edit":
        if (outcome.proposal.needsPreview) this.#openPreview(line, outcome.proposal, group);
        else this.#apply(outcome.proposal, group);
    }
  }

  #apply(proposal: Proposal, group: ResultGroup): void {
    this.#port.apply(proposal.after);
    this.#applied(proposal.summary, group);
  }

  /** The tick, and the bar it enters on while playing; stopped, it is already in. */
  #applied(summary: string, group: ResultGroup): void {
    const state = this.#port.state();
    const row = group.applied(summary, state.playing ? strings.onNextBar : strings.applied);
    if (state.playing) this.#waiting.push({ row, bar: state.bar ?? -1 });
  }

  #perform(action: SessionAction, group: ResultGroup): void {
    const result = this.#port.perform(action);
    if (!result.ok) {
      group.error(failureText(result.code), null, () => undefined);
      return;
    }
    switch (action.kind) {
      case "undo":
      case "redo":
        this.#applied(action.kind === "undo" ? strings.undone : strings.redone, group);
        return;
      case "solo":
        group.applied(result.released === true ? strings.soloReleased(action.track) : strings.solo(action.track), "");
        return;
      case "drop":
        this.#applied(strings.dropped, group);
        return;
      default:
        group.applied(action.kind === "play" ? strings.playing : strings.stopped, "");
    }
  }

  #openPreview(line: string, proposal: Proposal, group: ResultGroup): void {
    const row = group.preview(proposal, { apply: () => this.#applyPreview(), cancel: () => this.#cancelPreview() });
    this.#preview = { line, proposal, group, row };
    this.line.hold(true);
    row.focusApply();
  }

  /** Apply: on the text it was made for, or made again if the text moved meanwhile. */
  #applyPreview(): boolean {
    const open = this.#preview;
    if (open === null) return false;
    this.#preview = null;
    this.line.hold(false);
    const source = this.#port.state().source;
    if (source !== open.proposal.before) {
      open.row.close(strings.previewAgain);
      this.#show(open.line, this.#commands.run(open.line, source), this.log.group(open.line));
      if (this.#preview === null) this.line.input.focus({ preventScroll: true });
      return true;
    }
    open.row.close("");
    this.#apply(open.proposal, open.group);
    this.line.input.focus({ preventScroll: true });
    return true;
  }

  #cancelPreview(): boolean {
    const open = this.#preview;
    if (open === null) return false;
    this.#preview = null;
    this.line.hold(false);
    open.row.close(strings.cancelled);
    this.line.input.focus({ preventScroll: true });
    return true;
  }

  /** The bar moved: what was waiting is now playing, and the bar line lights once. */
  update(state: TerminalState): void {
    if (this.#litBar !== null && (state.bar === null || state.bar > this.#litBar)) {
      this.line.rest();
      this.#litBar = null;
    }
    if (!state.playing || state.bar === null) {
      this.#waiting = [];
      return;
    }
    const bar = state.bar;
    const arrived = this.#waiting.filter((entry) => bar > entry.bar);
    if (arrived.length === 0) return;
    this.#waiting = this.#waiting.filter((entry) => bar <= entry.bar);
    for (const entry of arrived) entry.row.setDetail(strings.playingSince(bar + 1));
    const reduced = prefersReducedMotion();
    this.line.pulse(reduced);
    if (reduced) this.#litBar = bar;
  }
}

export function createTerminal(options: TerminalOptions): Terminal {
  const titleId = uniqueId("ut-terminal-title");
  const controller = new TerminalController(options, titleId);
  const title = el("h3", "ut-terminal__title", text.commands);
  title.id = titleId;
  const header = el("div", "ut-terminal__header", undefined, title, el("p", "ut-terminal__keys", text.terminalHint));
  const well = el("div", "ut-terminal__well", undefined, controller.log.help, controller.log.root, controller.line.root);
  const root = el("section", "ut-terminal", undefined, header, well);
  root.setAttribute("aria-labelledby", titleId);
  const unsubscribe = options.port.subscribe((state) => controller.update(state));
  const stopLifting = liftAboveKeyboard(controller.line.root, controller.line.input);
  return {
    root,
    focus: () => controller.line.input.focus({ preventScroll: true }),
    destroy: () => {
      unsubscribe();
      stopLifting();
      root.remove();
    },
  };
}
