// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { ENGINE_NAMES } from "./engine-parameters";
import {
  IssueCollector,
  isRecord,
  readChoice,
  readName,
  readNumber,
  readOptionalChoice,
  readPattern,
  readString,
  type Fields,
} from "./manifest-fields";
import { checkAgainstEngine, readParameters } from "./manifest-parameters";
import { readPatterns } from "./manifest-patterns";
import { readPresets, readTags, readTone, readToneLevel } from "./manifest-presets";
import {
  INSTRUMENT_GROUPS,
  type InstrumentEngine,
  type InstrumentKind,
  type InstrumentManifest,
  type InstrumentPreset,
  type ManifestParameter,
  type ManifestResult,
  type VoiceAllocation,
  type VoiceSteal,
} from "./manifest-types";
import { readPitchRange } from "../pitch/pitch-range";
import { readScene } from "./manifest-scene";

// Contract of instruments/<name>/manifest.json.
// packages/dsp/build.rs reads the same files and enforces the same rules
// that matter to the DSP; the two are kept in agreement by the registry tests.

export type {
  InstrumentEngine,
  InstrumentGroup,
  InstrumentKind,
  InstrumentManifest,
  InstrumentPreset,
  ManifestIssue,
  ManifestPattern,
  ManifestParameter,
  ManifestResult,
  ToneMapping,
  VoiceAllocation,
  VoiceSteal,
} from "./manifest-types";
export { INSTRUMENT_GROUPS } from "./manifest-types";
export { isPresetName } from "./manifest-presets";

const KINDS: readonly InstrumentKind[] = ["drum", "pitched", "chord"];
const ENGINES: readonly InstrumentEngine[] = ["legacy", ...ENGINE_NAMES];
const ALLOCATIONS: readonly VoiceAllocation[] = ["poly", "mono"];
const STEALS: readonly VoiceSteal[] = ["oldest", "released-quietest"];
/** The first three instruments, older than the engines, are the only ones without an engine table. */
const LEGACY_INSTRUMENTS: ReadonlySet<string> = new Set(["kick", "hat", "bass"]);
const MAX_PREVIEW_LENGTH = 256;
const MAX_VOICES = 32;
const DESCRIPTION_LENGTH = { min: 8, max: 60 } as const;

interface EngineFields {
  readonly engine: InstrumentEngine;
  readonly parameters: readonly ManifestParameter[];
}

/** The engine, and the parameters checked against its table. */
function readEngine(fields: Fields, name: string, issues: IssueCollector): EngineFields {
  const engine = readOptionalChoice(fields["engine"], ENGINES, "legacy", "engine", issues);
  if (engine === "legacy" && !LEGACY_INSTRUMENTS.has(name)) {
    issues.add("engine", `"legacy" is reserved for kick, hat and bass`);
  }
  const parameters = readParameters(fields["parameters"], issues);
  checkAgainstEngine(parameters, engine, issues);
  return { engine, parameters };
}

type VoiceFields = Pick<InstrumentManifest, "voices" | "allocation" | "steal" | "costPerVoice">;

function readVoicePool(fields: Fields, issues: IssueCollector): VoiceFields {
  const voices = readNumber(
    fields["voices"],
    "voices",
    issues,
    (v) => Number.isInteger(v) && v >= 1 && v <= MAX_VOICES,
    `must be a whole number from 1 to ${MAX_VOICES}`,
  );
  const allocation = readOptionalChoice(fields["allocation"], ALLOCATIONS, "poly", "allocation", issues);
  if (allocation === "mono" && voices !== 1) issues.add("allocation", "a mono instrument has voices 1");
  return {
    voices,
    allocation,
    steal: readOptionalChoice(fields["steal"], STEALS, "oldest", "steal", issues),
    costPerVoice: readNumber(fields["costPerVoice"], "costPerVoice", issues, (v) => v > 0, "must be above 0"),
  };
}

type LibraryFields = Pick<InstrumentManifest, "group" | "description" | "model" | "tags">;
/** A model name: letters, digits, spaces and hyphens, 3..20 characters. */
const MODEL_NAME = /^[A-Za-z0-9][A-Za-z0-9 -]{1,18}[A-Za-z0-9]$/;

/** How the library lists the instrument. */
function readListing(fields: Fields, issues: IssueCollector): LibraryFields {
  const model = fields["model"];
  if (model !== undefined && model !== null && (typeof model !== "string" || !MODEL_NAME.test(model))) {
    issues.add("model", "must be 3 to 20 letters, digits, spaces or hyphens");
  }
  return {
    group: readChoice(fields["group"], INSTRUMENT_GROUPS, "group", issues),
    description: readString(
      fields["description"],
      "description",
      issues,
      (text) => text.length >= DESCRIPTION_LENGTH.min && text.length <= DESCRIPTION_LENGTH.max,
      "must be 8 to 60 characters",
    ),
    model: typeof model === "string" ? model : null,
    tags: readTags(fields["tags"], issues),
  };
}

function readManifest(fields: Fields, issues: IssueCollector): InstrumentManifest {
  const name = readName(fields, "name", issues);
  const { engine, parameters } = readEngine(fields, name, issues);
  const voicePool = readVoicePool(fields, issues);
  const { presets, defaultPreset } = readPresets(fields, parameters, issues);
  const kind = readChoice(fields["kind"], KINDS, "kind", issues);
  const pitchRange = readPitchRange(fields["range"], kind !== "drum");
  for (const problem of pitchRange.problems) issues.add(problem.path, problem.message);
  const listing = readListing(fields, issues);
  const patterns = readPatterns(fields["patterns"], issues);
  const tone = readTone(fields["tone"], parameters, issues);
  return {
    name,
    group: listing.group,
    kind,
    engine,
    description: listing.description,
    model: listing.model,
    tags: listing.tags,
    ...voicePool,
    defaultPattern: patterns[0]?.text ?? "",
    patterns,
    preview: readPattern(fields["preview"], "preview", MAX_PREVIEW_LENGTH, issues),
    defaultDuck: readNumber(fields["defaultDuck"], "defaultDuck", issues, (v) => v >= 0 && v <= 1, "must be within 0..1"),
    parameters,
    tone,
    presets,
    defaultPreset,
    scene: readScene(fields["scene"], { kind, parameters, tone }, issues),
    range: pitchRange.range,
    toneLevelDb: readToneLevel(fields["toneLevelDb"], issues),
  };
}

/** Validates untrusted JSON against every rule of the manifest table. Never throws. */
export function parseManifest(json: unknown): ManifestResult {
  const issues = new IssueCollector();
  if (!isRecord(json)) return { ok: false, issues: [{ path: "", message: "must be an object" }] };
  const manifest = readManifest(json, issues);
  return issues.issues.length === 0 ? { ok: true, manifest } : { ok: false, issues: issues.issues };
}

/** The preset of a manifest by name, or the default one for null. */
export function presetOf(manifest: InstrumentManifest, name: string | null): InstrumentPreset | undefined {
  return manifest.presets.find((preset) => preset.name === (name ?? manifest.defaultPreset));
}
