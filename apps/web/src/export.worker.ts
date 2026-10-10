// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Export worker entry: the composition hands the export its transport and registry, as
// it does for the live transport worker. Loaded only when the export sheet starts a job.
import { startExportWorker } from "@untzel/export/worker";
import type { ClockPort, EventSink } from "@untzel/session";
import { Transport } from "@untzel/transport";
import { buildRegistry } from "@untzel/instrument-index";

const built = buildRegistry();
const registry = built.registry;
const createTransport = (clock: ClockPort, sink: EventSink) => new Transport({ clock, sink });
startExportWorker(self as DedicatedWorkerGlobalScope, {
  createTransport,
  registry,
  instruments: built.instruments.map((manifest) => manifest.name),
});
