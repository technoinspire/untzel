// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Transport worker entry: wires the transport to the worklet clock and event sink.
import { startTransportWorker } from "@untzel/audio/worker";
import { PreviewTransport, Transport } from "@untzel/transport";

startTransportWorker(
  self as DedicatedWorkerGlobalScope,
  (clock, sink) => new Transport({ clock, sink }),
  (clock, sink) => new PreviewTransport({ clock, sink }),
);
