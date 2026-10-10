// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words of the play range and of the export's stretch, part of the
// controls' catalog (strings.ts re-exports them). Positions are bar.beat ("3.2.3") and
// times m:ss.s ("0:07.3"), formatted in views/export-stretch-model.ts.
/** The play range: the row, the ruler and the parts' buttons. */
export const rangeStrings = {
  playRange: "Play range",
  rangeStart: "Range start",
  rangeEnd: "Range end",
  start: "Start",
  end: "End",
  clearRange: "Clear range",
  wholeLoop: "Whole loop · drag a handle or tap two bars",
  wholeSong: "Whole song · drag a handle or tap two bars",
  wholeLoopValue: "whole loop",
  wholeSongValue: "whole song",
  cycle: "Cycle",
  on: "On",
  off: "Off",
  toHere: "To here",
  inRange: "In range",
  oneBarLoop: "The loop is 1 bar.",
  /** The desktop's key under the chip, in the loop. */
  legend: "Band = range · white line = playing now · orange outline = the bar you edit",
  listHintVisible: "starts the range at a part. To here extends it.",
  listHintNoRange: "starts the range at a part.",
  listHintAccessible: "The bracket button starts the range at a part. To here extends it.",
  listHintNoRangeAccessible: "The bracket button starts the range at a part.",
} as const;

/** Copy of the play range with numbers or names in it; bars are 1-based. */
export const rangePhrases = {
  /** "bars 3–6", "bar 3". */
  bars: (start: number, end: number): string => (start === end ? `bar ${start}` : `bars ${start}–${end}`),
  chip: (start: number, end: number): string => `Range: ${rangePhrases.bars(start, end)}`,
  loopNote: (start: number, end: number): string =>
    start === end ? `Repeats bar ${start}. Changes on the next bar.` : `Repeats bars ${start} to ${end}. Changes on the next bar.`,
  /** "build → drop, bars 9–28", or only the bars off the part boundaries. */
  stretch: (names: string | null, start: number, end: number): string =>
    names === null ? rangePhrases.bars(start, end) : `${names}, ${rangePhrases.bars(start, end)}`,
  cycleOn: (stretch: string): string => `Repeats ${stretch}. With Cycle off it plays on into the rest of the song.`,
  cycleOff: (from: string): string => `Plays from ${from}, then on into the rest of the song.`,
  /** The loop's label: "bars 3–6 of 8". */
  barsOf: (start: number, end: number, total: number): string => `${rangePhrases.bars(start, end)} of ${total}`,
  /** The phone's last resort: "109–128". */
  barNumbers: (start: number, end: number): string => (start === end ? String(start) : `${start}–${end}`),
  /** A Cycle-off song range: "from build, bar 9", "from bar 10". */
  fromStart: (part: string | null, bar: number): string => `from ${rangePhrases.from(part, bar)}`,
  /** The song label off the part boundaries: "from bar 10". */
  fromBar: (bar: number): string => `from bar ${bar}`,
  /** "build, bar 9" or "bar 10". */
  from: (part: string | null, bar: number): string => (part === null ? `bar ${bar}` : `${part}, bar ${bar}`),
  pendingBar: (bar: number): string => `From bar ${bar}: tap the end bar`,
  pendingPart: (part: string): string => `From ${part}: tap the end part`,
  /** aria-valuetext: "Start, bar 3 of 8", "End, bar 28 of 56, drop", "Start, bar 1 of 8, whole loop". */
  handleValue: (handle: string, bar: number, lastBar: number, extra: string | null): string =>
    `${handle}, bar ${bar} of ${lastBar}${extra === null ? "" : `, ${extra}`}`,
  /** Over a handle while it is dragged, and as the text of a part row: "Start · bar 3". */
  handleLabel: (handle: string, bar: number): string => `${handle} · bar ${bar}`,
  setRangeToPart: (part: string): string => `Set range to ${part}`,
  /** Starts with the visible "To here" (WCAG 2.5.3, label in name). */
  extendRangeTo: (part: string): string => `To here: extend the range to ${part}`,
  playPartOnly: (part: string): string => `Play ${part} only`,
  playFromNoteMoves: (bar: number): string => `Play from here moves the range start to bar ${bar}, on the next bar.`,
  playFromNoteBars: (start: number, end: number): string => `Play from here plays bars ${start} to ${end}, on the next bar.`,
  playFromNoteSong: (bar: number): string => `Play from here plays the song from bar ${bar}, on the next bar.`,
  /** The export sheet's Selected range: "Bars 9–28 · build → drop", "Bar 3". */
  exportRange: (start: number, end: number, names: string | null): string =>
    `${start === end ? `Bar ${start}` : `Bars ${start}–${end}`}${names === null ? "" : ` · ${names}`}`,
} as const;

/** The export's stretch: the play range's ruler, finer than a bar. */
export const exportStretchStrings = {
  ruler: "Export range",
  fine: "Fine",
  fineHint: "1/64 steps; Shift or Alt while dragging",
  usePlayRange: "Use play range",
  useWholeLoop: "Use whole loop",
  useWholeSong: "Use whole song",
  /** Plays the stretch about to be exported, from its first bar to its last. */
  listen: "Listen",
  stopListening: "Stop",
  listenHint: "Plays the export range from its first bar",
} as const;
export const exportStretchPhrases = {
  /** "Story up to 1:00", "4K up to 4:21". */
  cap: (what: string, limit: string): string => `${what} up to ${limit}`,
  /** "0:07.3 · bar 3.2 → 0:21.8 · bar 7.1". */
  readout: (start: string, startBar: string, end: string, endBar: string): string => `${start} · bar ${startBar} → ${end} · bar ${endBar}`,
  /** Over a handle while dragged: "Start · 0:07.3 · 3.2". */
  dragLabel: (handle: string, time: string, barBeat: string): string => `${handle} · ${time} · ${barBeat}`,
  /** aria-valuetext: "Start, 0:07.3, bar 3 beat 2". */
  handleValue: (handle: string, time: string, spoken: string): string => `${handle}, ${time}, ${spoken}`,
  /** "bar 3 beat 2", "bar 3 beat 3 step 3", "… and 1/64". */
  spokenPosition: (bar: number, beat: number, step: number, fine: number): string =>
    `bar ${bar} beat ${beat}${step === 1 && fine === 0 ? "" : ` step ${step}`}${fine === 0 ? "" : ` and ${fine}/64`}`,
} as const;
