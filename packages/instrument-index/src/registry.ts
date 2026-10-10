// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import {
  createRegistry,
  instrumentNames,
  parseManifest,
  type InstrumentManifest,
  type InstrumentRegistry,
} from "@untzel/core";
import { manifests } from "./generated/manifests";

export interface BuiltRegistry {
  readonly registry: InstrumentRegistry;
  /** Manifests in instrumentId order. */
  readonly instruments: readonly InstrumentManifest[];
}

/** Throws on an invalid manifest or a duplicate name: a build defect, caught by registry.test.ts. */
export function buildRegistry(): BuiltRegistry {
  const parsed = manifests.map((json, index) => {
    const result = parseManifest(json);
    if (!result.ok) {
      const issues = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ");
      throw new Error(`Invalid instrument manifest #${index}: ${issues}`);
    }
    return result.manifest;
  });
  const registry = createRegistry(parsed);
  const instruments = instrumentNames(registry).map((name) => {
    const manifest = registry.get(name);
    if (manifest === undefined) throw new Error(`Registry lost ${name}`);
    return manifest;
  });
  return { registry, instruments };
}
