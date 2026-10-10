// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The skin contract: what any skin receives and emits. The intents, the mount
// options, the product's shortcut map and the reduced-motion policy. At run time it reaches
// no other package: core, the session, i18n and the view model arrive as types only.
export type * from "./intents";
export type * from "./project-intents";
export type * from "./mount";
export { describeKey, shortcutFor, type KeyDescriptor, type ShortcutAction } from "./shortcuts";
export {
  effectiveReducedMotion,
  nextReducedMotionChoice,
  readReducedMotionChoice,
  REDUCED_MOTION_KEY,
  writeReducedMotionChoice,
  type MotionChoice,
  type MotionPreferenceStore,
} from "./reduced-motion-preference";
export { isReducedMotionDocument, MOTION_ATTRIBUTE, motionAttributeValue, writeMotionAttribute } from "./motion-attribute";
