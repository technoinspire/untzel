// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every recorded pack the build bundles has a credit in credits.json: the credit lists the
// pack file, names the instrument and carries the same license. The credits page says it
// lists exactly what the build ships, so a pack without its credit fails the check.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Credit } from "../content/sources";

interface Pack {
  /** Path relative to the repository, as credits.json lists it. */
  readonly file: string;
  readonly instrument: string;
  readonly licenseId: string | null;
}

function folders(path: string): readonly string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** instruments/<instrument>/samples/<version>/pack.json, in path order. */
function listPacks(repo: string): readonly Pack[] {
  return folders(join(repo, "instruments")).flatMap((instrument) =>
    folders(join(repo, "instruments", instrument, "samples")).flatMap((version) => {
      const file = `instruments/${instrument}/samples/${version}/pack.json`;
      if (!existsSync(join(repo, file))) return [];
      const pack = JSON.parse(readFileSync(join(repo, file), "utf8")) as { readonly license?: { readonly id?: unknown } };
      const licenseId = typeof pack.license?.id === "string" ? pack.license.id : null;
      return [{ file, instrument, licenseId }];
    }),
  );
}

function packProblems(pack: Pack, credits: readonly Credit[]): string[] {
  const credit = credits.find((candidate) => candidate.files.includes(pack.file));
  if (credit === undefined) return [`${pack.file}: no credit in credits.json lists this pack`];
  const problems: string[] = [];
  if (!credit.usedBy.includes(pack.instrument)) problems.push(`${pack.file}: credit "${credit.id}" does not list "${pack.instrument}" in usedBy`);
  if (pack.licenseId !== credit.license.id) problems.push(`${pack.file}: license ${pack.licenseId ?? "(none)"} differs from ${credit.license.id} of credit "${credit.id}"`);
  return problems;
}

export function checkCreditCoverage(repo: string, credits: readonly Credit[]): string[] {
  return listPacks(repo).flatMap((pack) => packProblems(pack, credits));
}
