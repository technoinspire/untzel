// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createRegistry, instrumentId, instrumentNames } from "@untzel/core";
import { describe, expect, it } from "vitest";
import { manifests } from "../generated/manifests";
import { buildRegistry } from "../registry";
import { registryWith } from "./test-registry";
const parsed = buildRegistry().instruments;
describe("registryWith", () => {
  it("gives a subset the same instrument ids as createRegistry of the same manifests", () => {
    const subset = parsed.filter((manifest) => ["kick", "hat", "bass"].includes(manifest.name));
    const expected = createRegistry(subset);
    const registry = registryWith(["kick", "hat", "bass"]);
    expect(instrumentNames(registry)).toEqual(instrumentNames(expected));
    for (const name of ["kick", "hat", "bass"]) expect(instrumentId(registry, name)).toBe(instrumentId(expected, name));
  });
  it("holds every manifest with no argument and none with an empty list", () => {
    expect(registryWith().size).toBe(manifests.length);
    expect(registryWith([]).size).toBe(0);
  });
  it("throws on a name that is not in instruments/", () => {
    expect(() => registryWith(["kick", "theremin"])).toThrow('registryWith: no instrument "theremin" in instruments/');
  });
});
