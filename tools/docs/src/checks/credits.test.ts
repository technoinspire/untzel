// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Credit } from "../content/sources";
import { checkCreditCoverage } from "./credits";

const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const CC0 = { id: "CC0-1.0", name: "Creative Commons Zero 1.0 Universal", url: "https://creativecommons.org/publicdomain/zero/1.0/" };
const KALIMBA_PACK = "instruments/kalimba/samples/v1/pack.json";

function credit(overrides: Partial<Credit> = {}): Credit {
  return {
    id: "vcsl",
    title: "Versilian Community Sample Library",
    authors: ["Versilian Studios LLC"],
    performers: null,
    license: CC0,
    url: "https://github.com/sgossner/VCSL",
    doi: null,
    citation: null,
    usedBy: ["kalimba"],
    changes: "Encoded as Opus.",
    files: [KALIMBA_PACK],
    ...overrides,
  };
}

describe("checkCreditCoverage", () => {
  let repo: string;
  const putPack = (file: string, licenseId: string): void => {
    mkdirSync(dirname(join(repo, file)), { recursive: true });
    writeFileSync(join(repo, file), JSON.stringify({ license: { id: licenseId } }));
  };

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "untzel-credits-test-"));
    putPack(KALIMBA_PACK, "CC0-1.0");
  });

  afterEach(() => {
    rmSync(repo, { recursive: true, force: true });
  });

  it("passes when every pack is listed, named and under the same license", () => {
    expect(checkCreditCoverage(repo, [credit()])).toEqual([]);
  });

  it("fails for a pack that no credit lists", () => {
    putPack("instruments/hat/samples/v1/pack.json", "CC0-1.0");
    expect(checkCreditCoverage(repo, [credit()])).toEqual(["instruments/hat/samples/v1/pack.json: no credit in credits.json lists this pack"]);
  });

  it("fails when the credit does not name the instrument", () => {
    expect(checkCreditCoverage(repo, [credit({ usedBy: ["bell"] })])).toEqual([`${KALIMBA_PACK}: credit "vcsl" does not list "kalimba" in usedBy`]);
  });

  it("fails when the pack and the credit disagree on the license", () => {
    putPack(KALIMBA_PACK, "CC-BY-4.0");
    expect(checkCreditCoverage(repo, [credit()])).toEqual([`${KALIMBA_PACK}: license CC-BY-4.0 differs from CC0-1.0 of credit "vcsl"`]);
  });

  it("passes on the real credits.json and instruments", () => {
    const real = (JSON.parse(readFileSync(join(REPO, "credits.json"), "utf8")) as { readonly credits: readonly Credit[] }).credits;
    expect(checkCreditCoverage(REPO, real)).toEqual([]);
  });
});
