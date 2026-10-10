// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// English interface copy of the editor and the composer terminal: the source catalog of
// @untzel/i18n, translated next to it (strings.pt-BR.ts) and read through copy.ts.

export const strings = {
  sourceLabel: "Untzel source",
  keepsPlaying: "The previous version keeps playing.",
  fixesFor: (message: string): string => `Fixes for: ${message}`,
  ignore: "Ignore",
  problemAt: (line: number, message: string): string => `Line ${line}: ${message} The previous version keeps playing.`,
  noFixHere: "No fix here.",
  tabLeaves: "Tab leaves the editor. Esc again closes Code.",
  /** The editor's description, read on focus before any Esc. */
  escThenTab: "Esc, then Tab leaves the editor.",

  // the Code area
  commands: "Commands",
  resize: "Resize the commands",

  // the command line
  terminalHint: "Tab completes · Alt+Down next suggestion · Up and Down for history",
  commandLabel: "Command",
  placeholder: "Type a command",
  run: "Run",
  suggestions: "Suggestions",
  results: "Results",
  emptyTitle: "Type a command, or help to list them.",
  emptyKeys: "Tab completes · Up and Down walk the history.",
  emptyChoose: "Alt+Down: next suggestion · Shift+Tab leaves.",
  emptyBar: "Changes play on the next bar.",
  didYouMean: "Did you mean",
  onNextBar: "on the next bar",
  applied: "applied",
  playingSince: (bar: number): string => `playing since bar ${bar}`,
  previewTitle: (title: string, lines: number): string => `Preview · ${title} · ${lines} ${lines === 1 ? "line" : "lines"}`,
  previewNote: "Nothing changes until you apply. The music keeps playing.",
  previewAgain: "The code changed meanwhile: here is the preview again.",
  apply: "Apply",
  cancel: "Cancel",
  cancelled: "Cancelled. Nothing changed.",
  diffAdded: "added",
  diffRemoved: "removed",

  // session use cases
  playing: "Playing.",
  stopped: "Stopped.",
  dropped: "Drop: every track on, on the next bar.",
  undone: "Undone.",
  redone: "Redone.",
  solo: (track: string): string => `Solo ${track}. Type solo ${track} again to release it.`,
  soloReleased: (track: string): string => `${track} is no longer soloed.`,
  // why a session use case refused, by the session's code (failureText in the terminal)
  failureNoProgram: "Nothing is loaded yet: fix the code first.",
  failureNotInLoop: "drop works in loop mode.",
  failureNothingToUndo: "Nothing to undo.",
  failureNothingToRedo: "Nothing to redo.",
  failureSongUnavailable: "There is no song to play: write a section first.",
  failureUnknownTrack: "That track no longer exists.",
  failed: "That didn't work; the music keeps playing.",
} as const;
