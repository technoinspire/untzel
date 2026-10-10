// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The simulator's registry is the build's: the same manifests, in the
// same order, as apps/web and packages/dsp/build.rs.
import { buildRegistry, type BuiltRegistry } from "@untzel/instrument-index";
export type SimRegistry = BuiltRegistry;
export function simRegistry(): SimRegistry {
  return buildRegistry();
}
