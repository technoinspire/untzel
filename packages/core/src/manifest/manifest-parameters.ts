// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { EFFECT_PARAMETERS } from "./effects";
import { ENGINE_PARAMETERS } from "./engine-parameters";
import {
  isFiniteNumber,
  isRecord,
  readChoice,
  readList,
  readName,
  readNumber,
  type Fields,
  type IssueCollector,
} from "./manifest-fields";
import { isWellFormedName } from "../program/names";
import type { InstrumentEngine, ManifestParameter } from "./manifest-types";
import type { Curve } from "../pattern/signal";

// The instrument parameters of a manifest and their agreement with the engine table.

const CURVES: readonly Curve[] = ["linear", "exponential"];

/** Modifier names the language owns; a manifest parameter cannot reuse them. */
const RESERVED_PARAMETER_NAMES: ReadonlySet<string> = new Set([
  "gain",
  "pan",
  "duck",
  "reverb",
  "delay",
  "tone",
  "mute",
  "free",
  "transpose",
  "swing",
  "shift",
  "velocity",
  "glide",
  "legato",
  "voicing",
  "inversion",
  "arp",
  "arp-rate",
  "arp-octaves",
  "loop",
  ...EFFECT_PARAMETERS.map((parameter) => parameter.name),
]);

/** A choice parameter: `{ name, choices, default }`, or its normalised form. */
function readChoiceParameter(fields: Fields, name: string, path: string, issues: IssueCollector): ManifestParameter {
  const list = readList(fields["choices"], `${path}.choices`, issues);
  const choices = list.filter((choice): choice is string => typeof choice === "string" && isWellFormedName(choice));
  if (choices.length !== list.length || choices.length < 2 || choices.length > 8 || new Set(choices).size !== choices.length) {
    issues.add(`${path}.choices`, "must be 2 to 8 distinct lower-case names");
  }
  const fallback = fields["default"];
  const index =
    typeof fallback === "string"
      ? choices.indexOf(fallback)
      : isFiniteNumber(fallback) && Number.isInteger(fallback) && fallback < choices.length
        ? fallback
        : -1;
  if (index < 0) issues.add(`${path}.default`, "must be one of the choices");
  return { name, min: 0, max: Math.max(1, choices.length - 1), default: Math.max(0, index), unit: "", curve: "linear", choices };
}

function readParameter(item: unknown, path: string, issues: IssueCollector): ManifestParameter {
  const fields = isRecord(item) ? item : {};
  if (!isRecord(item)) issues.add(path, "must be an object");
  const name = readName(fields, `${path}.name`, issues);
  if (RESERVED_PARAMETER_NAMES.has(name)) {
    issues.add(`${path}.name`, `"${name}" is a general modifier name`);
  }
  if (Array.isArray(fields["choices"]) && fields["choices"] !== null) {
    return readChoiceParameter(fields, name, path, issues);
  }
  const min = readNumber(fields["min"], `${path}.min`, issues, () => true, "must be a number");
  const max = readNumber(fields["max"], `${path}.max`, issues, (v) => v > min, "must be above min");
  const fallback = readNumber(
    fields["default"],
    `${path}.default`,
    issues,
    (v) => v >= min && v <= max,
    "must be within min..max",
  );
  const curve = readChoice(fields["curve"], CURVES, `${path}.curve`, issues);
  if (curve === "exponential" && min <= 0) {
    issues.add(`${path}.min`, "must be above 0 for an exponential curve");
  }
  const unit = fields["unit"];
  if (typeof unit !== "string") issues.add(`${path}.unit`, "must be a string");
  return { name, min, max, default: fallback, unit: typeof unit === "string" ? unit : "", curve, choices: null };
}

/** Name, unit and curve of the engine table; ranges only narrow; choices a subset in order. */
export function checkAgainstEngine(
  parameters: readonly ManifestParameter[],
  engine: InstrumentEngine,
  issues: IssueCollector,
): void {
  if (engine === "legacy") return;
  const table = ENGINE_PARAMETERS[engine];
  parameters.forEach((parameter, index) => {
    const path = `parameters[${index}]`;
    const canonical = table[parameter.name];
    if (canonical === undefined) {
      issues.add(`${path}.name`, `"${parameter.name}" is not a parameter of the ${engine} engine`);
      return;
    }
    if (canonical.kind === "choice") {
      const choices = parameter.choices ?? [];
      const positions = choices.map((choice) => canonical.choices.indexOf(choice));
      const ordered = positions.every((position, i) => position >= 0 && (i === 0 || position > (positions[i - 1] ?? -1)));
      if (parameter.choices === null || !ordered) {
        issues.add(`${path}.choices`, `must be a subset of ${canonical.choices.join(", ")}, in that order`);
      }
      return;
    }
    if (parameter.choices !== null) {
      issues.add(`${path}.choices`, `"${parameter.name}" is continuous in the ${engine} engine`);
      return;
    }
    if (parameter.unit !== canonical.unit) issues.add(`${path}.unit`, `must be "${canonical.unit}"`);
    if (parameter.curve !== canonical.curve) issues.add(`${path}.curve`, `must be ${canonical.curve}`);
    if (parameter.min < canonical.min || parameter.max > canonical.max) {
      issues.add(`${path}.min`, `may narrow ${canonical.min}..${canonical.max}, never widen it`);
    }
  });
}

export function readParameters(value: unknown, issues: IssueCollector): readonly ManifestParameter[] {
  const parameters = readList(value, "parameters", issues).map((item, index) =>
    readParameter(item, `parameters[${index}]`, issues),
  );
  const seen = new Set<string>();
  parameters.forEach((parameter, index) => {
    if (seen.has(parameter.name)) issues.add(`parameters[${index}].name`, "is repeated");
    seen.add(parameter.name);
  });
  return parameters;
}
