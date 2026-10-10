// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { isRecord, readList, readPattern, readString, type IssueCollector } from "./manifest-fields";
import type { ManifestPattern } from "./manifest-types";

// The named starting patterns of a manifest, written in
// c minor like the preview. The first one is the pattern a new track starts with, so
// `defaultPattern` is derived from it and never written twice.

export const MAX_PATTERNS = 6;
export const MAX_PATTERN_NAME_LENGTH = 24;
export const MAX_PATTERN_TEXT_LENGTH = 1024;

/** 1..6 patterns, each a label (free English text) and a pattern text, names unique. */
export function readPatterns(value: unknown, issues: IssueCollector): readonly ManifestPattern[] {
  const list = readList(value, "patterns", issues);
  if (list.length === 0 || list.length > MAX_PATTERNS) issues.add("patterns", `must list 1 to ${MAX_PATTERNS} patterns`);
  const patterns = list.slice(0, MAX_PATTERNS).map((entry, index): ManifestPattern => {
    const path = `patterns[${index}]`;
    if (!isRecord(entry)) {
      issues.add(path, "must be an object");
      return { name: "", text: "" };
    }
    const name = readString(
      entry["name"],
      `${path}.name`,
      issues,
      (text) => text.trim().length > 0 && text.length <= MAX_PATTERN_NAME_LENGTH,
      `must be 1 to ${MAX_PATTERN_NAME_LENGTH} characters`,
    );
    return { name, text: readPattern(entry["text"], `${path}.text`, MAX_PATTERN_TEXT_LENGTH, issues) };
  });
  patterns.forEach((pattern, index) => {
    if (pattern.name !== "" && patterns.findIndex((other) => other.name === pattern.name) !== index) {
      issues.add(`patterns[${index}].name`, "must be unique in the manifest");
    }
  });
  return patterns;
}
