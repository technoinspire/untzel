// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The device probe as the page keeps it: one JSON value per browser profile,
// valid only for the device key it was measured on. A new browser version, another
// screen or less memory gives a new key, and the next Render probes again. Pure: the
// composition reads and writes localStorage; this only says what the value means.
import { QUALITIES, type DeviceProbe, type ExportQuality, type TierProbe } from "./tiers";

export const PROBE_CACHE_KEY = "untzel.export.device-probe";
const VERSION = 1;

/** What identifies a device for the probe; the composition reads it from navigator and screen. */
export interface DeviceTraits {
  readonly userAgent: string;
  readonly cores: number;
  /** navigator.deviceMemory, where the browser has it. */
  readonly memoryGb: number | null;
  readonly screenWidth: number;
  readonly screenHeight: number;
  readonly pixelRatio: number;
}

export function deviceKey(traits: DeviceTraits): string {
  const screen = `${Math.max(traits.screenWidth, traits.screenHeight)}x${Math.min(traits.screenWidth, traits.screenHeight)}@${traits.pixelRatio}`;
  return [traits.userAgent, traits.cores, traits.memoryGb ?? "?", screen].join("|");
}

export function serializeProbe(probe: DeviceProbe, key: string): string {
  return JSON.stringify({ version: VERSION, key, tiers: probe.tiers });
}

/** The kept probe if it is this device's and well formed; null otherwise (probe again). */
export function parseProbe(text: string | null, key: string): DeviceProbe | null {
  if (text === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value["version"] !== VERSION || value["key"] !== key || !Array.isArray(value["tiers"])) return null;
  const tiers = value["tiers"].map(tierOf);
  return tiers.every((tier): tier is TierProbe => tier !== null) ? { tiers } : null;
}

function tierOf(value: unknown): TierProbe | null {
  if (!isRecord(value)) return null;
  const { quality, isSupported, framesPerSecond } = value;
  if (!QUALITIES.includes(quality as ExportQuality) || typeof isSupported !== "boolean") return null;
  if (framesPerSecond !== null && (typeof framesPerSecond !== "number" || !Number.isFinite(framesPerSecond) || framesPerSecond < 0)) return null;
  return { quality: quality as ExportQuality, isSupported, framesPerSecond };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
