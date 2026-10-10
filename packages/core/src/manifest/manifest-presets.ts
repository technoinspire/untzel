// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  isFiniteNumber,
  isRecord,
  readList,
  readNumber,
  readString,
  type Fields,
  type IssueCollector,
} from "./manifest-fields";
import type { InstrumentPreset, ManifestParameter, ToneMapping } from "./manifest-types";

// What a manifest says about its sound: the named sounds, the tone mapping, the level
// correction of tone and the search tags.

/**
 * A sound name never starts with "x" (a hit) and never reads like a note or a tonic:
 * the PresetName token of the grammar.
 */
const PRESET_RULE = /^(?:[h-wyz][a-z0-9-]*|[a-g][ac-z-][a-z0-9-]*|[a-g]b[a-z-][a-z0-9-]*)$/;
const MAX_PRESET_LENGTH = 24;
const MAX_PRESETS = 12;
const TAG_RULE = /^[a-z]+$/;
const MAX_TAGS = 8;
const MAX_TONE_LEVEL_DB = 40;

export function isPresetName(name: string): boolean {
  return name.length <= MAX_PRESET_LENGTH && PRESET_RULE.test(name);
}

/** A preset value: a number in range, or a choice name (normalised to its index). */
function readPresetValue(
  parameter: ManifestParameter | undefined,
  value: unknown,
  path: string,
  issues: IssueCollector,
): number | null {
  if (parameter === undefined) {
    issues.add(path, "must name a parameter of the instrument");
    return null;
  }
  if (parameter.choices !== null && typeof value === "string") {
    const index = parameter.choices.indexOf(value);
    if (index >= 0) return index;
    issues.add(path, `must be one of ${parameter.choices.join(", ")}`);
    return null;
  }
  const inRange = (v: number): boolean =>
    v >= parameter.min && v <= parameter.max && (parameter.choices === null || Number.isInteger(v));
  if (isFiniteNumber(value) && inRange(value)) return value;
  issues.add(path, "must be within the parameter range");
  return null;
}

function readPreset(
  item: unknown,
  path: string,
  parameters: readonly ManifestParameter[],
  issues: IssueCollector,
): InstrumentPreset {
  const fields = isRecord(item) ? item : {};
  if (!isRecord(item)) issues.add(path, "must be an object");
  const name = readString(fields["name"], `${path}.name`, issues, isPresetName, "must be a sound name (a-z, 0-9, -; not x…, not a note)");
  const description = readString(fields["description"], `${path}.description`, issues, (text) => text.length > 0 && text.length <= 60, "must be 1 to 60 characters");
  const rawValues = fields["values"];
  const values: Record<string, number> = {};
  if (!isRecord(rawValues)) {
    issues.add(`${path}.values`, "must be an object");
  } else {
    for (const [key, raw] of Object.entries(rawValues)) {
      const parameter = parameters.find((candidate) => candidate.name === key);
      const value = readPresetValue(parameter, raw, `${path}.values.${key}`, issues);
      if (value !== null) values[key] = value;
    }
  }
  return { name, description, values };
}

export function readPresets(
  fields: Fields,
  parameters: readonly ManifestParameter[],
  issues: IssueCollector,
): { readonly presets: readonly InstrumentPreset[]; readonly defaultPreset: string } {
  const list = readList(fields["presets"], "presets", issues);
  if (list.length < 1 || list.length > MAX_PRESETS) issues.add("presets", `must have 1 to ${MAX_PRESETS} sounds`);
  const presets = list.map((item, index) => readPreset(item, `presets[${index}]`, parameters, issues));
  const names = presets.map((preset) => preset.name);
  names.forEach((name, index) => {
    if (names.indexOf(name) !== index) issues.add(`presets[${index}].name`, "is repeated");
  });
  const defaultPreset = readString(fields["defaultPreset"], "defaultPreset", issues, (name) => names.includes(name), "must name one of the presets");
  const fallback = presets.find((preset) => preset.name === defaultPreset);
  if (fallback !== undefined && Object.keys(fallback.values).length > 0) {
    issues.add("defaultPreset", "the default sound has no values: its values are the parameter defaults");
  }
  return { presets, defaultPreset };
}

export function readTone(
  value: unknown,
  parameters: readonly ManifestParameter[],
  issues: IssueCollector,
): readonly ToneMapping[] {
  return readList(value, "tone", issues).map((item, index) => {
    const path = `tone[${index}]`;
    const fields = isRecord(item) ? item : {};
    const name = fields["parameter"];
    const target = parameters.find((parameter) => parameter.name === name);
    if (target === undefined) issues.add(`${path}.parameter`, "must name a parameter");
    if (target?.choices !== null && target !== undefined) issues.add(`${path}.parameter`, "cannot map a choice");
    const inRange = (v: number): boolean =>
      target === undefined || (v >= target.min && v <= target.max);
    const rule = "must be within the parameter range";
    return {
      parameter: typeof name === "string" ? name : "",
      from: readNumber(fields["from"], `${path}.from`, issues, inRange, rule),
      to: readNumber(fields["to"], `${path}.to`, issues, inRange, rule),
    };
  });
}

export function readToneLevel(raw: unknown, issues: IssueCollector): number {
  if (raw === undefined) return 0;
  if (typeof raw !== "number" || !Number.isFinite(raw) || Math.abs(raw) > MAX_TONE_LEVEL_DB) {
    issues.add("toneLevelDb", `must be a number of dB within ±${MAX_TONE_LEVEL_DB}`);
    return 0;
  }
  return raw;
}

export function readTags(value: unknown, issues: IssueCollector): readonly string[] {
  const list = readList(value, "tags", issues);
  const tags = list.filter((tag): tag is string => typeof tag === "string" && TAG_RULE.test(tag));
  if (tags.length !== list.length || tags.length > MAX_TAGS) issues.add("tags", `must be at most ${MAX_TAGS} lower-case words`);
  return tags;
}
