// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { MainToWorkerMessage } from "../protocol";
import {
  STATS_INTERVAL_MS,
  TICK_INTERVAL_MS,
  TransportHost,
  type PreviewFactory,
  type TransportFactory,
} from "./transport-host";

export type { MessageTarget } from "./worklet-event-sink";
export { WorkletEventSink } from "./worklet-event-sink";
export { WorkletClock } from "./worklet-clock";
export { HeldClock } from "./held-clock";
export type { PreviewControl, PreviewFactory, TransportControl, TransportFactory, WorkletPort } from "./transport-host";
export { STATS_INTERVAL_MS, TICK_INTERVAL_MS, TransportHost } from "./transport-host";

/** Worker entry wiring: handles MainToWorkerMessage, runs tick() every 25 ms. */
export function startTransportWorker(
  scope: DedicatedWorkerGlobalScope,
  createTransport: TransportFactory,
  createPreview: PreviewFactory,
): void {
  const host = new TransportHost(scope, createTransport, createPreview, () => performance.now());
  scope.onmessage = (event: MessageEvent<MainToWorkerMessage>) => host.receive(event.data);
  scope.setInterval(() => host.tick(), TICK_INTERVAL_MS);
  scope.setInterval(() => host.requestStats(), STATS_INTERVAL_MS);
}
