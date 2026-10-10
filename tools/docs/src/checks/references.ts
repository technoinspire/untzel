// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The generated references against their sources: the instrument tables against the
// registry, every diagnostic code, every shortcut action and every feature state.
import { DIAGNOSTIC_CODES } from "@untzel/language";
import { FEATURES } from "../../../../apps/docs/src/features";
import type { BuiltPage } from "../build";
import { SHORTCUT_KINDS } from "../directives/app";
import type { FeatureStates } from "../content/features";
import type { DocsSources } from "../content/sources";

function page(pages: readonly BuiltPage[], id: string): readonly BuiltPage[] {
  return pages.filter((candidate) => candidate.id === id);
}

/** Every parameter row: instrument, name, data-values of min, max, default, unit and curve. */
function parameterRows(body: string): readonly string[] {
  return [...body.matchAll(/<tr data-instrument="([^"]+)" data-parameter="([^"]+)" data-unit="([^"]*)" data-curve="([^"]+)">([\s\S]*?)<\/tr>/g)].map((match) => {
    const values = [...(match[5] ?? "").matchAll(/data-value="([^"]+)"/g)].map((value) => value[1]);
    return [match[1], match[2], ...values, match[3], match[4]].join(" ");
  });
}

export function checkInstrumentReference(pages: readonly BuiltPage[], sources: DocsSources): string[] {
  const expected = sources.built.instruments.flatMap((manifest) =>
    manifest.parameters.map((p) => [manifest.name, p.name, p.min, p.max, p.default, p.unit, p.curve].join(" ")),
  );
  return page(pages, "instruments").flatMap((built) => {
    const rows = parameterRows(built.body);
    return JSON.stringify(rows) === JSON.stringify(expected) ? [] : [`${built.path}: the parameter tables differ from the manifests\n  page:      ${rows.join(" | ")}\n  manifests: ${expected.join(" | ")}`];
  });
}

export function checkDiagnosticReference(pages: readonly BuiltPage[]): string[] {
  return page(pages, "reference").flatMap((built) =>
    DIAGNOSTIC_CODES.filter((code) => !built.body.includes(`data-code="${code}"`)).map((code) => `${built.path}: ${code} is not in the error reference`),
  );
}

export function checkShortcutReference(pages: readonly BuiltPage[]): string[] {
  return page(pages, "app").flatMap((built) =>
    Object.keys(SHORTCUT_KINDS).filter((kind) => !built.body.includes(`data-shortcut="${kind}"`)).map((kind) => `${built.path}: shortcut ${kind} is not in the table`),
  );
}

export function checkFeatureMarks(pages: readonly BuiltPage[], features: FeatureStates): string[] {
  const failures: string[] = [];
  for (const built of pages) {
    for (const match of built.body.matchAll(/data-feature="([^"]+)" data-state="([^"]+)"/g)) {
      const expected = features.get(match[1] as (typeof FEATURES)[number]["id"]) === true ? "available" : "planned";
      if (match[2] !== expected) failures.push(`${built.path}: feature ${match[1]} marked ${match[2]}, probe says ${expected}`);
    }
  }
  return failures;
}
