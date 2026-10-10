// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// One command of a take file, checked field by field and rebuilt, so an unknown field
// never reaches the replay.
import type { Program } from "@untzel/core";
import type { PlaybackMode, PlayRangeChange } from "@untzel/session";
import {
  fail,
  readArray,
  readBoolean,
  readInteger,
  readNullableString,
  readOneOf,
  readRecord,
  readString,
  type FieldRecord,
} from "./codec-fields";
import type { TakeCommand, TextDiff } from "./take";

const MODES: readonly PlaybackMode[] = ["loop", "song"];
const HIGHEST_MIDI = 127;

export function decodeCommand(value: unknown, field: string): TakeCommand {
  const record = readRecord(value, field);
  const kind = record.kind;
  switch (kind) {
    case "sounding":
      return decodeSounding(record, field);
    case "play": {
      const startBar = record.startBar === null ? null : readInteger(record.startBar, `${field}.startBar`);
      return { kind, mode: readOneOf(record.mode, MODES, `${field}.mode`), startBar };
    }
    case "mode":
      return { kind, mode: readOneOf(record.mode, MODES, `${field}.mode`) };
    case "stop":
    case "auditionStop":
      return { kind };
    case "range":
      return { kind, change: decodeRangeChange(record.change, `${field}.change`) };
    case "background":
      return { kind, isHidden: readBoolean(record.isHidden, `${field}.isHidden`) };
    case "audition":
      return { kind, program: decodeProgram(record.program, `${field}.program`) };
    case "auditionNote":
      return decodeAuditionNote(record, field);
    default:
      return fail("MALFORMED", `${field}.kind: unknown command`);
  }
}

function decodeSounding(record: FieldRecord, field: string): TakeCommand {
  const source = readRecord(record.source, `${field}.source`);
  const diff: TextDiff = {
    at: readInteger(source.at, `${field}.source.at`),
    remove: readInteger(source.remove, `${field}.source.remove`),
    insert: readString(source.insert, `${field}.source.insert`),
  };
  const solo = readNullableString(record.solo, `${field}.solo`);
  if (record.preview === null) return { kind: "sounding", source: diff, solo, preview: null };
  const preview = readRecord(record.preview, `${field}.preview`);
  return {
    kind: "sounding",
    source: diff,
    solo,
    preview: { track: readString(preview.track, `${field}.preview.track`), text: readString(preview.text, `${field}.preview.text`) },
  };
}

/** A play range of bars counted from 1, start ≤ end, or null. */
function decodeRangeChange(value: unknown, field: string): PlayRangeChange {
  const change = readRecord(value, field);
  const mode = readOneOf(change.mode, MODES, `${field}.mode`);
  const locate = readBoolean(change.locate, `${field}.locate`);
  if (change.range === null) return { mode, range: null, locate };
  const range = readRecord(change.range, `${field}.range`);
  const startBar = readInteger(range.startBar, `${field}.range.startBar`, 1);
  const endBar = readInteger(range.endBar, `${field}.range.endBar`, startBar);
  return { mode, range: { startBar, endBar, cycle: readBoolean(range.cycle, `${field}.range.cycle`) }, locate };
}

function decodeAuditionNote(record: FieldRecord, field: string): TakeCommand {
  const midis = readArray(record.midis, `${field}.midis`).map((midi, index) => readInteger(midi, `${field}.midis[${index}]`, 0, HIGHEST_MIDI));
  const seconds = record.seconds;
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) fail("MALFORMED", `${field}.seconds: not a duration`);
  return { kind: "auditionNote", program: decodeProgram(record.program, `${field}.program`), midis, seconds };
}

/**
 * The audition's one-track program, demo only: its shape is checked (an object with a
 * track list), its content is the analyzer's own output from the recording page.
 */
function decodeProgram(value: unknown, field: string): Program {
  const program = readRecord(value, field);
  readArray(program.tracks, `${field}.tracks`);
  readRecord(program.tempo, `${field}.tempo`);
  return program as unknown as Program;
}
