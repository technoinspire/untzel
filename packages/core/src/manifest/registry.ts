// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { parseManifest, type InstrumentManifest } from "./manifest";

/**
 * Manifests by name, in UTF-16 code-unit order of name. The position in this order is
 * the instrumentId the DSP uses; packages/dsp/build.rs sorts the same way.
 */
export type InstrumentRegistry = ReadonlyMap<string, InstrumentManifest>;

function byCodeUnit(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Throws on an invalid manifest or a duplicate name: that is a build defect, not user
 * input.
 */
export function createRegistry(manifests: readonly InstrumentManifest[]): InstrumentRegistry {
  const registry = new Map<string, InstrumentManifest>();
  const sorted = [...manifests].sort((a, b) => byCodeUnit(a.name, b.name));
  for (const manifest of sorted) {
    const result = parseManifest(manifest);
    if (!result.ok) {
      const details = result.issues.map((issue) => `${issue.path} ${issue.message}`).join("; ");
      throw new Error(`Invalid instrument manifest "${String(manifest.name)}": ${details}`);
    }
    if (registry.has(manifest.name)) {
      throw new Error(`Duplicate instrument manifest "${manifest.name}".`);
    }
    // packages/dsp/build.rs turns "-" into "_" for the module name.
    const module = manifest.name.replaceAll("-", "_");
    const collision = [...registry.keys()].find((name) => name.replaceAll("-", "_") === module);
    if (collision !== undefined) {
      throw new Error(`Instrument names "${collision}" and "${manifest.name}" collide once "-" becomes "_".`);
    }
    registry.set(manifest.name, result.manifest);
  }
  return registry;
}

/** Names in instrumentId order. */
export function instrumentNames(registry: InstrumentRegistry): readonly string[] {
  return [...registry.keys()].sort(byCodeUnit);
}

/** instrumentId of a name, or null when the name is not registered. */
export function instrumentId(registry: InstrumentRegistry, name: string): number | null {
  const index = instrumentNames(registry).indexOf(name);
  return index === -1 ? null : index;
}
