// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ControlsPort } from "@untzel/skin-contract";
import type { InstrumentRegistry } from "@untzel/core";
import { parameterValueAt } from "@untzel/session";
import type { DemoAction, DemoActionKind } from "../actions";

// Which real gesture performs each demo action. The intent names are checked against
// ControlsPort at compile time, so a renamed intent breaks this file, not the recording.

export type IntentName = keyof ControlsPort;

/** The gesture: an intent of the controls, or typing in the Code panel. */
export type DemoControl =
  | { readonly kind: "intent"; readonly intent: IntentName }
  | { readonly kind: "code"; readonly why: string };

const INTENTS = {
  addTrack: "addTrack",
  setStepCount: "setStepCount",
  setTrackBars: "setBars",
  toggleStep: "toggleStep",
  setStepNote: "setStepPitch",
  setMute: "setMute",
  setLoopBars: "setLoopBars",
  addSectionMember: "toggleSectionMember",
  togglePlay: "togglePlay",
  setMode: "setMode",
  drop: "drop",
  renameTrack: "renameTrack",
} as const satisfies Partial<Record<DemoActionKind, IntentName>>;

function intent(name: IntentName): DemoControl {
  return { kind: "intent", intent: name };
}

function code(why: string): DemoControl {
  return { kind: "code", why };
}

/** Tone has its own knob; the rest of the sliders go through setParameter. */
function parameterControl(action: Extract<DemoAction, { kind: "setParameter" }>, instrument: string | undefined, registry: InstrumentRegistry): DemoControl {
  if (action.parameter === "tone") return intent("setTone");
  const manifest = instrument === undefined ? undefined : registry.get(instrument);
  if (parameterValueAt(manifest, action.parameter, 0.5) === null) return code(`no slider for "${action.parameter}"`);
  return intent("setParameter");
}

/**
 * The gesture for `action`. `instrumentOf` gives the instrument of a track by its current
 * name, so parameter sliders can be looked up in the manifest.
 */
export function controlFor(
  action: DemoAction,
  instrumentOf: (track: string) => string | undefined,
  registry: InstrumentRegistry,
): DemoControl {
  switch (action.kind) {
    case "typeCode":
      return code(action.reason);
    case "setParameter":
      return parameterControl(action, instrumentOf(action.track), registry);
    default:
      return intent(INTENTS[action.kind]);
  }
}
