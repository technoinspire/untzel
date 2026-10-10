// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { MAX_PART_BARS, MIN_PART_BARS, setSection, setSong, suggest, type SongPartText } from "@untzel/language";
import type { CommandContext } from "../reading/context";
import { nameError } from "../reading/name-errors";
import { error, type CommandOutcome } from "../proposal/outcome";
import { strings } from "../copy/copy";
import { readNumber } from "../reading/words";

// section and song: the arrangement lines.

export function section(context: CommandContext): CommandOutcome {
  const name = context.argument(0, strings.sectionNeedsName);
  if (!name.ok) return name.outcome;
  // An existing section is rewritten, so no name is taken here.
  const problem = nameError(name.value.text, new Set());
  if (problem !== null) return problem;
  const words = context.args.slice(1);
  if (words.length === 0) return error(strings.needs(strings.sectionNeedsTracks, context.example), context.example);
  const known = context.names.tracks.map((track) => track.name);
  for (const word of words) {
    if (known.includes(word.text)) continue;
    const near = suggest(word.text, known);
    return error(strings.unknownTrack(word.text), near === null ? null : context.suggestLine(word, near));
  }
  const tracks = words.map((word) => word.text);
  const exists = context.names.sections.some((entry) => entry.name === name.value.text);
  return context.propose(setSection(context.source, name.value.text, tracks), {
    title: context.line,
    summary: strings.section(name.value.text, [...new Set(tracks)]),
    destructive: exists,
  });
}

interface WrittenPart {
  readonly section: string;
  readonly bars: string;
}

function readParts(text: string): readonly WrittenPart[] | null {
  const parts = text.split(",").map((part) => part.trim().split(/\s+/));
  if (parts.some((part) => part.length !== 2)) return null;
  return parts.map(([section = "", bars = ""]) => ({ section, bars }));
}

function songLine(parts: readonly WrittenPart[]): string {
  return `song ${parts.map((part) => `${part.section} ${part.bars}`).join(", ")}`;
}

export function song(context: CommandContext): CommandOutcome {
  const text = context.args.map((word) => word.text).join(" ");
  const parts = text === "" ? null : readParts(text);
  if (parts === null) return error(strings.needs(strings.songNeedsParts, context.example), context.example);
  const known = context.names.sections.map((entry) => entry.name);
  const checked: SongPartText[] = [];
  for (const [index, part] of parts.entries()) {
    if (!known.includes(part.section)) {
      const near = suggest(part.section, known);
      const fixed = near === null ? null : songLine(parts.map((entry, at) => (at === index ? { ...entry, section: near } : entry)));
      return error(strings.unknownSection(part.section), fixed);
    }
    const bars = readNumber(part.bars);
    if (bars === null || !Number.isInteger(bars) || bars < MIN_PART_BARS || bars > MAX_PART_BARS) {
      const clamped = bars === null ? 8 : Math.min(Math.max(Math.round(bars), MIN_PART_BARS), MAX_PART_BARS);
      const fixed = songLine(parts.map((entry, at) => (at === index ? { ...entry, bars: String(clamped) } : entry)));
      return error(strings.wholeBetween(strings.barsOfPart(part.section), MIN_PART_BARS, MAX_PART_BARS), fixed);
    }
    checked.push({ section: part.section, bars });
  }
  return context.propose(setSong(context.source, checked), {
    title: context.line,
    summary: strings.song(checked.map((part) => `${part.section} ${part.bars}`).join(", ")),
    // Replacing a written song overwrites what the person arranged.
    destructive: /^[ \t]*song\b/m.test(context.source),
  });
}
