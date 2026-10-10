// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InstrumentRegistry } from "@untzel/core";
import type { ExportTimeline, ExportTransportFactory } from "./timeline";
export type { ExportTransport, ExportTransportFactory } from "./timeline";
export interface ExportWorkerOptions {
  readonly createTransport: ExportTransportFactory;
  readonly registry: InstrumentRegistry;
  /** Names in registry order; index = the instrument id in the DSP. */
  readonly instruments: readonly string[];
  /**
   * A take's timeline from its encoded text. The app does not render takes, so it
   * passes none and a take is refused; a composition that renders takes passes its loader.
   */
  readonly loadTakeTimeline?: (take: string) => Promise<ExportTimeline>;
}
