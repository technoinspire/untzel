// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Every demo action and how it is done in the interface: one gesture per action kind,
// exhaustive by type.
import type { DemoAction } from "../../actions";
import type { GestureContext, GesturePage, Gestures } from "../gesture-page";
import { addSectionMember } from "./add-section-member";
import { addTrack } from "./add-track";
import { drop } from "./drop";
import { renameTrack } from "./track/rename-track";
import { setLoopBars } from "./set-loop-bars";
import { setMode } from "./set-mode";
import { setMute } from "./track/set-mute";
import { setParameter } from "./track/set-parameter";
import { setStepCount } from "./track/set-step-count";
import { setStepNote } from "./track/set-step-note";
import { setTrackBars } from "./track/set-track-bars";
import { toggleStep } from "./track/toggle-step";
import { togglePlay } from "./toggle-play";
import { typeCode } from "./type-code";

export const GESTURES = {
  addTrack,
  renameTrack,
  setStepCount,
  setTrackBars,
  toggleStep,
  setStepNote,
  setParameter,
  setMute,
  setLoopBars,
  addSectionMember,
  typeCode,
  togglePlay,
  setMode,
  drop,
} as const satisfies Gestures;

/** Does `action` in the interface. */
export function perform(page: GesturePage, action: DemoAction, context: GestureContext): Promise<void> {
  const gesture = GESTURES[action.kind] as (page: GesturePage, action: DemoAction, context: GestureContext) => Promise<void>;
  return gesture(page, action, context);
}
