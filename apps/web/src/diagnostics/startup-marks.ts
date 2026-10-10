// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The phases between the tap and the first kick, as User Timing marks named
// `untzel:<phase>`: the first-sound measurement reads them, and so can anyone with the
// browser's performance panel on a phone.

export type StartupPhase = "boot" | "dsp-compiled" | "engine-created" | "sound-started" | "first-play";

export function markStartup(phase: StartupPhase): void {
  performance.mark(`untzel:${phase}`);
}
