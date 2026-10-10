// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The take as text: the page posts this string to the export worker and the demo writes
// it to a file. The decoder is the only way a take comes in, and it checks everything
// before returning; no text of a take is ever run, it only goes to the analyzer, like a
// received link.
import { MAX_SOURCE_LENGTH } from "@untzel/session/limits";
import {
  TakeFormatError,
  fail,
  readArray,
  readInteger,
  readOneOf,
  readRecord,
  readString,
  type TakeDecodeFailure,
} from "./codec-fields";
import { MAX_TAKE_ENTRIES, MAX_TAKE_TEXT_CHARS, TAKE_FORMAT, TAKE_VERSION, type Take, type TakeEntry } from "./take";
import { decodeCommand } from "./take-command-codec";
import { takeSpan } from "./take-span";
import { applyTextDiff } from "./text-diff";

export type { TakeDecodeFailure } from "./codec-fields";
export type DecodedTake =
  | { readonly ok: true; readonly take: Take }
  | { readonly ok: false; readonly reason: TakeDecodeFailure; readonly detail: string };

/** The whole file, checked before JSON.parse. */
const MAX_TAKE_FILE_CHARS = 64_000_000;
const MIN_SAMPLE_RATE = 8_000;
const MAX_SAMPLE_RATE = 192_000;
const MAX_INSTRUMENTS = 256;
const MAX_INSTRUMENT_NAME_CHARS = 64;
const MAX_TITLE_CHARS = 200;
const ENDINGS: readonly Take["endedBy"][] = ["stop", "cap", "full", "interrupted"];
const BIGINT_FIELD = "$bigint";
const BIGINT_DIGITS = /^-?\d+$/;

/** JSON; the bigints of an audition's Rational values become {"$bigint": "…"}. */
export function encodeTake(take: Take): string {
  return JSON.stringify(take, (_key, value: unknown) => (typeof value === "bigint" ? { [BIGINT_FIELD]: value.toString() } : value));
}

export function decodeTake(text: string): DecodedTake {
  if (text.length > MAX_TAKE_FILE_CHARS) return { ok: false, reason: "TOO_LARGE", detail: "file too long" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text, reviveBigint);
  } catch {
    return { ok: false, reason: "MALFORMED", detail: "not JSON" };
  }
  try {
    return { ok: true, take: readTake(parsed) };
  } catch (error: unknown) {
    if (error instanceof TakeFormatError) return { ok: false, reason: error.reason, detail: error.message };
    throw error;
  }
}

function reviveBigint(_key: string, value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const digits = (value as Readonly<Record<string, unknown>>)[BIGINT_FIELD];
  if (typeof digits !== "string") return value;
  if (!BIGINT_DIGITS.test(digits)) throw new SyntaxError("bad bigint");
  return BigInt(digits);
}

function readTake(value: unknown): Take {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail("NOT_A_TAKE", "not an object");
  const record = value as Readonly<Record<string, unknown>>;
  if (record.format !== TAKE_FORMAT) fail("NOT_A_TAKE", "format");
  if (record.version !== TAKE_VERSION) fail("UNKNOWN_VERSION", `version ${String(record.version)}`);
  const sampleRate = readInteger(record.sampleRate, "sampleRate", MIN_SAMPLE_RATE, MAX_SAMPLE_RATE);
  const armFrame = readInteger(record.armFrame, "armFrame");
  const endFrame = readInteger(record.endFrame, "endFrame", armFrame);
  const take: Take = {
    format: TAKE_FORMAT,
    version: TAKE_VERSION,
    sampleRate,
    armFrame,
    endFrame,
    endedBy: readOneOf(record.endedBy, ENDINGS, "endedBy"),
    entries: readEntries(record.entries, armFrame, endFrame),
    instruments: readInstruments(record.instruments),
    title: record.title === null ? null : readText(record.title, "title", MAX_TITLE_CHARS),
  };
  if (takeSpan(take) === null) fail("MALFORMED", `no play started, or under a second from the first sound`);
  return take;
}

/** What the entries carry along: the frame rules and the text being rebuilt. */
interface EntriesState {
  frame: number;
  horizon: number | null;
  text: string;
  chars: number;
}

function readEntries(value: unknown, armFrame: number, endFrame: number): readonly TakeEntry[] {
  const list = readArray(value, "entries");
  if (list.length === 0) fail("MALFORMED", "entries: empty");
  if (list.length > MAX_TAKE_ENTRIES) fail("TOO_LARGE", `entries: more than ${MAX_TAKE_ENTRIES}`);
  const state: EntriesState = { frame: armFrame, horizon: null, text: "", chars: 0 };
  return list.map((item, index) => readEntry(item, `entries[${index}]`, state, endFrame));
}

/** The recorder's rules, again: frames never descend and stay in the take; horizons as the recorder writes them. */
function readEntry(value: unknown, field: string, state: EntriesState, endFrame: number): TakeEntry {
  const record = readRecord(value, field);
  const command = decodeCommand(record.command, `${field}.command`);
  const frame = readInteger(record.frame, `${field}.frame`, state.frame, endFrame);
  const horizon = record.horizon === null ? null : readInteger(record.horizon, `${field}.horizon`, state.horizon ?? 0);
  state.frame = frame;
  state.horizon = horizon;
  if (command.kind === "sounding") readTexts(command, field, state);
  if (record.startFrame === undefined) return { command, frame, horizon };
  if (command.kind !== "play") fail("MALFORMED", `${field}.startFrame: only a play starts the music`);
  return { command, frame, horizon, startFrame: readInteger(record.startFrame, `${field}.startFrame`, frame) };
}

/** Each diff applies to the text before it; every text fits a received link (MAX_SOURCE_LENGTH). */
function readTexts(command: Extract<TakeEntry["command"], { kind: "sounding" }>, field: string, state: EntriesState): void {
  try {
    state.text = applyTextDiff(state.text, command.source);
  } catch {
    fail("MALFORMED", `${field}.command.source: does not apply to the text before it`);
  }
  state.chars += command.source.insert.length + (command.preview?.text.length ?? 0);
  if (state.chars > MAX_TAKE_TEXT_CHARS) fail("TOO_LARGE", `${field}: more than ${MAX_TAKE_TEXT_CHARS} characters of text`);
  if (state.text.length > MAX_SOURCE_LENGTH) fail("TOO_LARGE", `${field}: a text longer than ${MAX_SOURCE_LENGTH}`);
  if ((command.preview?.text.length ?? 0) > MAX_SOURCE_LENGTH) fail("TOO_LARGE", `${field}: a preview longer than ${MAX_SOURCE_LENGTH}`);
}

function readInstruments(value: unknown): readonly string[] {
  const list = readArray(value, "instruments");
  if (list.length > MAX_INSTRUMENTS) fail("MALFORMED", `instruments: more than ${MAX_INSTRUMENTS}`);
  return list.map((name, index) => {
    const text = readText(name, `instruments[${index}]`, MAX_INSTRUMENT_NAME_CHARS);
    if (text.length === 0) fail("MALFORMED", `instruments[${index}]: empty`);
    return text;
  });
}

function readText(value: unknown, field: string, maxChars: number): string {
  const text = readString(value, field);
  if (text.length > maxChars) fail("MALFORMED", `${field}: longer than ${maxChars}`);
  return text;
}
