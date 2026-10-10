// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentManifest } from "@untzel/core";
import { printNumber } from "@untzel/language";
import { assistStrings as say } from "../copy/copy";
import type { ParameterInfo } from "../reading/vocabulary";

// Short English descriptions shared by completion, hints and hover help.

function printed(value: number): string {
  return printNumber(value) ?? String(value);
}

/** "40 to 8000 Hz, default 600"; "small, wide, sea, for example wide"; "a flag, no value". */
export function parameterDetail(parameter: ParameterInfo): string {
  switch (parameter.kind) {
    case "flag":
      return say.flag;
    case "choice":
      return say.choice(parameter.choices, parameter.example);
    case "number": {
      const fallback = parameter.default === null ? say.forExample(parameter.example) : say.byDefault(printed(parameter.default));
      return say.range(printed(parameter.min), printed(parameter.max), parameter.unit, parameter.integer, fallback);
    }
  }
}

/** "Drums · plays hits": the group and kind in words, for the completion list. */
export function instrumentDetail(manifest: InstrumentManifest | undefined): string {
  return manifest === undefined ? "" : say.hoverInstrumentKind(manifest.group, manifest.kind);
}

/** "sine(8) 40..8000": a signal over the whole range of the parameter. */
export function signalExample(parameter: Extract<ParameterInfo, { kind: "number" }>, shape = "sine", period = 8): string {
  return `${shape}(${period}) ${printed(parameter.min)}..${printed(parameter.max)}`;
}

/** "open 0", "gain 0.8", "free": a modifier with a value the analysis accepts. */
export function parameterWithValue(parameter: ParameterInfo): string {
  switch (parameter.kind) {
    case "flag":
      return parameter.name;
    case "choice":
      return `${parameter.name} ${parameter.example}`;
    case "number":
      return `${parameter.name} ${parameter.default === null ? parameter.example : printed(parameter.default)}`;
  }
}
