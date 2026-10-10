// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The song's tempo and key of the deferred port: forwarded to the running controls once
// the engine runs, dropped before. Part of the initial JS: types only.
import type { StatementIntents } from "@untzel/skin-contract";
import type { RunningControls } from "../../adapters/session-controls-port";

export function forwardStatements(running: () => RunningControls | null): StatementIntents {
  return {
    setTempo: (bpm) => running()?.statements.setTempo(bpm),
    setKey: (tonic, scale) => running()?.statements.setKey(tonic, scale),
  };
}
