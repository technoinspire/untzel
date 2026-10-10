// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What identifies this device for the export's probe: a new browser, another
// screen or less memory probes again. Read from the page, nothing stored here.
import type { DeviceTraits } from "@untzel/export";

export function deviceTraits(): DeviceTraits {
  const memory = (navigator as Navigator & { readonly deviceMemory?: number }).deviceMemory;
  return {
    userAgent: navigator.userAgent,
    cores: navigator.hardwareConcurrency || 1,
    memoryGb: typeof memory === "number" ? memory : null,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    pixelRatio: window.devicePixelRatio || 1,
  };
}
