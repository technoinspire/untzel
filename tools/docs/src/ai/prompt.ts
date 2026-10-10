// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The copyable prompt that teaches an assistant the language, from the same sources as the
// pages. English in both languages (the code is English); it asks the assistant to answer
// in the person's language. No Untzel literal lives in this folder: every code sample is an
// example of apps/docs/examples/, analyzed by docs:check like every other.
import { TITLE_MAX_CODE_POINTS, type InstrumentManifest, type ManifestParameter } from "@untzel/core";
import { createFormatters } from "@untzel/i18n";
import { DIAGNOSTIC_CODES, LANGUAGE_FACTS, type ModifierFact } from "@untzel/language";
import { strings } from "../../../../apps/docs/src/strings";
import { fence } from "../render/components";
import { diagnosticEntry } from "../directives/diagnostics";
import type { DocsSources } from "../content/sources";

const en = createFormatters("en");
const number = (value: number): string => en.number(value, { maximumFractionDigits: 6, useGrouping: Math.abs(value) >= 10_000 });

/** Examples the prompt shows, by id, in this order. */
export const PROMPT_EXAMPLES = {
  structure: "structure",
  patterns: "mini-notation",
  notes: "notes",
  signals: "signals",
  song: "sections-and-song",
} as const;

/** Error examples shown in full; every other code is listed by message only. */
export const PROMPT_ERROR_EXAMPLES = ["PATTERN_KIND_MISMATCH", "SIGNAL_NEEDS_RANGE", "UNKNOWN_MODIFIER", "OUT_OF_ORDER"] as const;

function example(sources: Pick<DocsSources, "examples">, id: string): string {
  const found = sources.examples.get(id);
  if (found === undefined) throw new Error(`the prompt needs apps/docs/examples/${id}.untzel`);
  return fence(found.text);
}

function modifierLine(fact: ModifierFact): string {
  const effect = strings.modifierEffect(fact.name);
  switch (fact.kind) {
    case "flag":
      return `- ${fact.name} (no value): ${effect}`;
    case "division":
      return `- ${fact.name} ${fact.divisions.join(" | ")}: ${effect}`;
    case "choice":
      return `- ${fact.name} ${fact.choices.join(" | ")}: ${effect}`;
    case "reverb":
      return `- ${fact.name} ${fact.spaces.join(" | ")} | ${number(fact.min)}..${number(fact.max)}: ${effect}`;
    case "number": {
      const kind = fact.integer ? "whole number " : "";
      const signal = fact.allowsSignal ? ", or a signal" : "";
      return `- ${fact.name} ${kind}${number(fact.min)}..${number(fact.max)}${signal}: ${effect}`;
    }
  }
}

const OUTPUT_TRIM = "level";
function instrumentLine(manifest: InstrumentManifest): string {
  // `level` is a named sound's own output trim, not a control to write.
  const parameters = manifest.parameters.filter((p) => !HIDDEN_FROM_PROMPT.has(p.name)).map(parameterText).join("; ");
  const sounds = [...manifest.presets].sort((a, b) => Number(b.name === manifest.defaultPreset) - Number(a.name === manifest.defaultPreset)).map((preset) => preset.name).join(", ");
  const tone = manifest.tone.map((mapping) => `${mapping.parameter} ${number(mapping.from)}→${number(mapping.to)}`).join(", ");
  return `- ${manifest.name}: ${strings.groupLabel(manifest.group)}, ${manifest.kind}. Parameters: ${parameters}. tone: ${tone}. Sounds: ${sounds}. Pattern: ${manifest.defaultPattern}`;
}

/**
 * "cutoff 80..12000=1800 Hz": the default after "="; "mix=0.5" for 0..1; "source
 * synth|samples=synth". Compact,
 * because the sound-design parameters of the instruments tripled the table and the prompt keeps
 * its 25 000-character budget.
 */
function parameterText(p: ManifestParameter): string {
  if (p.choices !== null) return `${p.name} ${p.choices.join("|")}=${p.choices[p.default] ?? ""}`;
  const unit = p.unit === "" ? "" : ` ${p.unit}`;
  if (p.min === 0 && p.max === 1 && unit === "") return `${p.name}=${number(p.default)}`;
  return `${p.name} ${number(p.min)}..${number(p.max)}=${number(p.default)}${unit}`;
}

function limitLines(): readonly string[] {
  return Object.entries(LANGUAGE_FACTS.limits).map(([name, value]) => `- ${strings.limitLabel(name)}: ${number(value)}`);
}

type PromptSources = Pick<DocsSources, "built" | "examples">;

/** Who the assistant is and where its answer goes. */
function introSection(): string {
  return "You write music in Untzel, the small text language of the Untzel app by Techno Inspire (https://app.untzel.com/). The person pastes your answer into the Code panel of the app, where it starts playing on the next bar.";
}

/** What to answer and what never to write. */
/** Not for a person writing music: the output trim, and `source` (a recorded instrument plays its recording). */
const HIDDEN_FROM_PROMPT: ReadonlySet<string> = new Set([OUTPUT_TRIM, "source"]);

function rulesSection(sources: PromptSources): string {
  const names = sources.built.instruments.map((manifest) => manifest.name);
  return `### Rules
- Answer with exactly one fenced code block whose info string is untzel, then at most three short lines about what you wrote. Write those lines in the language the person uses; code, keywords, instrument names and parameter names stay in English.
- Write only the syntax on this page. Untzel is analyzed, never executed: it has no JavaScript, no functions, no variables, no imports, no for or while loops, no arithmetic and no expressions. Do not borrow syntax from Strudel, TidalCycles, Sonic Pi or any other tool.
- Use only these instruments: ${names.join(", ")}. Use only the parameters listed for each, inside their ranges. If the person asks for an instrument that is not listed, say so and use the closest one listed.
- Every name is lower case: [a-z][a-z0-9_-]*, at most ${number(LANGUAGE_FACTS.limits["MAX_NAME_LENGTH"] ?? 0)} characters. Comments start with // and run to the end of the line.`;
}

/** The order of a text and its globals. */
function structureSection(sources: PromptSources): string {
  const { tempo, swing, key, loop } = LANGUAGE_FACTS.globals;
  return `### Structure
A text has, in this order, each part optional:
1. globals, each at most once: title "<text>" (at most ${number(TITLE_MAX_CODE_POINTS)} characters, never changes the sound); tempo <bpm> (${number(tempo.min)}..${number(tempo.max)}, default ${number(tempo.default)}); key <tonic> <scale> (tonic a..g with optional b or #; scales ${key.scales.join(", ")}; default ${key.default}); swing <amount> (${number(swing.min)}..${number(swing.max)}, default ${number(swing.default)}); loop <bars> (whole number ${number(loop.min)}..${number(loop.max)}; absent by default): in loop mode one pass lasts that many bars and every pattern restarts at its start, so a 4-bar pattern plays 4 times in loop 16; without it every pattern repeats on its own length. Song mode ignores it;
2. tracks, one per line: [<name>:] <instrument> <pattern> ( | <modifier> [value] )*. Two tracks may use the same instrument; each is its own instance;
3. sections: section <name> <track> <track> ... ( | tempo <bpm> ) ( | gain <0..1> );
4. at most one song: song <section> <bars>, <section> <bars> ... [ | loop ].
Without a song every track that is not muted plays in a loop. With sections and no song, each section plays 8 bars, in order, in a cycle.
${example(sources, PROMPT_EXAMPLES.structure)}`;
}

/**
 * The mini-notation. The bullet "the draw of ? and rand is deterministic" left the prompt
 * to make room for `title` under the then 24 000-character budget: an assistant writes the same
 * text either way, and the guarantee stays on the language page (#determinism). The prompt
 * now sits a few characters under the budget, so the next language change raises the
 * budget in checks/budgets.ts with its reason instead of cutting another line.
 */
function patternsSection(sources: PromptSources): string {
  return `### Patterns
- A pattern is one bar; / separates bars of a longer pattern, which repeats when it ends. The steps of a bar divide it equally.
- Hits for drum instruments: x hit, X accent, . rest, ~ holds the previous step one more step. In a run of hits every character is a step, so x... x... is 8 steps.
- [ ] subdivides one step; ? plays with a chance (default ${number(LANGUAGE_FACTS.limits["DEFAULT_PROBABILITY"] ?? 0)}), as in x?0.3; *n repeats inside the same step, as in x*4.
${example(sources, PROMPT_EXAMPLES.patterns)}`;
}

/** Notes, chords and the scale lock. */
function notesSection(sources: PromptSources): string {
  return `### Notes and the scale lock
- Pitched instruments play notes: lower-case letter, optional b or #, octave digit: c1, eb2, f#1. . is a rest and ~ holds the note.
- With a key, notes outside the scale move to the nearest degree of it; | free turns that off for one track, and key c chromatic turns it off everywhere.
- Chord names (Cm7, Abmaj7) need an instrument of kind chord; none of the listed instruments is one, so write notes.
${example(sources, PROMPT_EXAMPLES.notes)}`;
}

/** The general modifiers. */
function modifiersSection(): string {
  return `### General modifiers (every instrument)
Chained with |, read left to right; when one repeats, the last wins (warning DUPLICATE_MODIFIER). A change to a constant number sounds immediately; everything else enters on the next bar.
${LANGUAGE_FACTS.modifiers.map(modifierLine).join("\n")}`;
}

/** Slow waves instead of numbers. */
function signalsSection(sources: PromptSources): string {
  return `### Signals
Every numeric parameter that allows it takes a slow wave instead of a number: <shape>(<bars>) <from>..<to>. Shapes: ${LANGUAGE_FACTS.signalShapes.join(", ")}. The range is required and stays inside the parameter's limits. The period is above 0 and at most ${number(LANGUAGE_FACTS.limits["MAX_SIGNAL_PERIOD"] ?? 0)} bars. In a song, a signal restarts at the start of every section, so saw(4) in a 4-bar section rises exactly across it.
${example(sources, PROMPT_EXAMPLES.signals)}`;
}

/** Sections and the song. */
function songSection(sources: PromptSources): string {
  return `### Sections and song
${example(sources, PROMPT_EXAMPLES.song)}`;
}

/** Every instrument of this build with its parameters. */
function instrumentsSection(sources: PromptSources): string {
  return `### Instruments
Per instrument: its group and kind (drum plays hits, pitched plays notes, chord plays chords); each parameter as name min..max=default unit, or name=default when it runs 0..1, or name choice|choice=default; what tone moves; its sounds, the default first (write a sound's name right after the instrument's name); its default pattern.
${sources.built.instruments.map(instrumentLine).join("\n")}`;
}

/** The fixed limits of the language. */
function limitsSection(): string {
  return `### Limits
${limitLines().join("\n")}`;
}

/** Every diagnostic, its fix and the common mistakes. */
function errorsSection(sources: PromptSources): string {
  const errors = DIAGNOSTIC_CODES.map((code) => diagnosticEntry(code, sources));
  const shown = new Set<string>(PROMPT_ERROR_EXAMPLES);
  return `### Errors
Invalid text never stops the music: the app keeps playing the last valid version and shows the code and message. If the person pastes an error back, fix exactly what it names.
${errors.map((entry) => `- ${entry.code}: ${entry.message} ${strings.diagnosticFix(entry.code)}`).join("\n")}
Examples of common mistakes:
${errors.filter((entry) => shown.has(entry.code) && entry.example !== null).map((entry) => `${entry.code}:\n${fence(entry.example ?? "")}`).join("\n")}`;
}

/** How to start an answer. */
function answerSection(): string {
  return `### Answer
Start with tempo and key and give every track a name. Add sections and a song only when the person asks for a whole song with parts; otherwise write a loop.`;
}

export function buildPrompt(sources: PromptSources): string {
  const sections = [
    introSection(),
    rulesSection(sources),
    structureSection(sources),
    patternsSection(sources),
    notesSection(sources),
    modifiersSection(),
    signalsSection(sources),
    songSection(sources),
    instrumentsSection(sources),
    limitsSection(),
    errorsSection(sources),
    answerSection(),
  ];
  return `${sections.join("\n\n")}\n`;
}
