// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { PROBE_CACHE_KEY, deviceKey, parseProbe, serializeProbe } from "@untzel/export";
import { describe, expect, it } from "vitest";
import { DeviceProbeStore, type ProbeApi, type ProbeStorage } from "./device-probe-store";

const api: ProbeApi = { PROBE_CACHE_KEY, deviceKey, parseProbe, serializeProbe };
const traits = { userAgent: "Chrome/154", cores: 10, memoryGb: 8, screenWidth: 1512, screenHeight: 982, pixelRatio: 2 };
const probe = { tiers: [{ quality: "hd" as const, isSupported: true, framesPerSecond: 70 }] };

function memoryStorage(): ProbeStorage & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => void values.set(key, value) };
}

describe("DeviceProbeStore", () => {
  it("has nothing before the first probe, and keeps it for the next visit", () => {
    const storage = memoryStorage();
    expect(new DeviceProbeStore(storage, traits).read(api)).toBeNull();
    new DeviceProbeStore(storage, traits).write(api, probe);
    expect(new DeviceProbeStore(storage, traits).read(api)).toEqual(probe);
  });

  it("probes again on another device", () => {
    const storage = memoryStorage();
    new DeviceProbeStore(storage, traits).write(api, probe);
    expect(new DeviceProbeStore(storage, { ...traits, cores: 4 }).read(api)).toBeNull();
  });

  it("keeps the probe for the page when storage refuses it", () => {
    const refusing: ProbeStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    const store = new DeviceProbeStore(refusing, traits);
    store.write(api, probe);
    expect(store.read(api)).toEqual(probe);
    expect(new DeviceProbeStore(null, traits).read(api)).toBeNull();
  });
});
