// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The device probe: before the first video Render of a device, about 1 s per
// tier in the export worker; a complete probe is kept for the device, and 4K picked before
// it falls back to HD when the probe does not offer 4K.
import type * as ExportModule from "@untzel/export";
import type { DeviceProbe, ExportClient, ExportResult } from "@untzel/export";
import type { DeviceProbeStore, ProbeApi as StoredProbeApi } from "./device-probe-store";
import type { RenderRequest } from "./export-render-request";

type ProbeApi = Pick<typeof ExportModule, "chooseTiers" | "isCompleteProbe"> & StoredProbeApi;

/** The probe's job in the worker, for the job record. */
export interface ProbeJob {
  readonly jobId: number;
  readonly request: RenderRequest;
  readonly isProbe: true;
  readonly startedAt: number;
}

/** The first video Render of a device: the probe runs first, the render after it. */
export function startProbe(client: ExportClient, request: RenderRequest, now: () => number): ProbeJob {
  const jobId = client.probe();
  return { jobId, request, isProbe: true, startedAt: now() };
}

/** Kept for the device when complete; then the render the person asked for, or HD when the probe refused 4K or did not finish. */
export function afterProbe(api: ProbeApi, probes: DeviceProbeStore, request: RenderRequest, result: ExportResult): RenderRequest {
  if (result.type === "probed") {
    // Only a complete probe is kept: a deadline missed on a busy machine is probed again next time.
    if (api.isCompleteProbe(result.probe)) probes.write(api, result.probe);
    else console.warn("export: the device probe missed a deadline; not kept, rendering HD");
  } else console.warn("export: the device probe did not finish; rendering without it");
  return withinProbe(api, request, result.type === "probed" ? result.probe : null);
}

/**
 * The job the probe allows: 4K chosen before the first probe renders HD when the probe
 * does not offer 4K (no codec at 4K, or not at real time), or did not finish.
 */
export function withinProbe(api: Pick<ProbeApi, "chooseTiers">, request: RenderRequest, probe: DeviceProbe | null): RenderRequest {
  if (request.fallback === null) return request;
  const offered = probe !== null && api.chooseTiers(probe).offers.some((offer) => offer.quality === request.plan.quality);
  return offered ? request : { ...request.fallback, fallback: null };
}
