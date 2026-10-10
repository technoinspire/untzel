// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The one test registry: the real manifests of instruments/, so a test
// names the instruments it needs instead of importing and validating their JSON. The manifests
// are the ones buildRegistry validates, so a test and the page read them through one parse.
import { createRegistry, type InstrumentRegistry } from "@untzel/core";
import { buildRegistry } from "../registry";
/**
 * The registry of the named instruments, ordered by name as createRegistry orders it; with no
 * argument, the whole library. An unknown name throws, with the name.
 */
export function registryWith(names?: readonly string[]): InstrumentRegistry {
  const { registry, instruments } = buildRegistry();
  if (names === undefined) return registry;
  const byName = new Map(instruments.map((manifest) => [manifest.name, manifest]));
  return createRegistry(
    names.map((name) => {
      const manifest = byName.get(name);
      if (manifest === undefined) throw new Error(`registryWith: no instrument "${name}" in instruments/`);
      return manifest;
    }),
  );
}
