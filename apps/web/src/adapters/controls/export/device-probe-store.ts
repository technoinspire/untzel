// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The device probe kept per device: read when the sheet opens (no work, no
// worker), written once the first Render has probed. localStorage may be missing or full
// (private mode): the probe then lives for the page and runs again on the next visit.
import type * as ExportModule from "@untzel/export";
import type { DeviceProbe, DeviceTraits } from "@untzel/export";

export type ProbeApi = Pick<typeof ExportModule, "PROBE_CACHE_KEY" | "deviceKey" | "parseProbe" | "serializeProbe">;

export interface ProbeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class DeviceProbeStore {
  readonly #storage: ProbeStorage | null;
  readonly #traits: DeviceTraits;
  #inMemory: DeviceProbe | null = null;

  constructor(storage: ProbeStorage | null, traits: DeviceTraits) {
    this.#storage = storage;
    this.#traits = traits;
  }

  read(api: ProbeApi): DeviceProbe | null {
    if (this.#inMemory !== null) return this.#inMemory;
    try {
      this.#inMemory = api.parseProbe(this.#storage?.getItem(api.PROBE_CACHE_KEY) ?? null, api.deviceKey(this.#traits));
    } catch {
      this.#inMemory = null;
    }
    return this.#inMemory;
  }

  write(api: ProbeApi, probe: DeviceProbe): void {
    this.#inMemory = probe;
    try {
      this.#storage?.setItem(api.PROBE_CACHE_KEY, api.serializeProbe(probe, api.deviceKey(this.#traits)));
    } catch {
      // Storage full or refused: the page keeps it in memory.
    }
  }
}
