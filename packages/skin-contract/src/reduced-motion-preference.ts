// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// "Reduced motion" in the menu: the switch shows the effective value, the
// choice saved on this device or else the system's prefers-reduced-motion. Turning it
// inverts the effective value; when the new value is the system's, the saved choice is
// removed and the switch follows the system again. Pure rules plus the ports.
export const REDUCED_MOTION_KEY = "untzel.motion.reduced";
/** The slice of Storage the motion choice needs, removal included. */
export interface MotionPreferenceStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
/** What the shell and the menu use; the page implements it (motion-setting.ts). */
export interface MotionChoice {
  isReduced(): boolean;
  isFollowingSystem(): boolean;
  toggle(): void;
  onChange(listener: () => void): () => void;
}
/** `saved`: the choice on this device, null when none. */
export function effectiveReducedMotion(saved: boolean | null, system: boolean): boolean {
  return saved ?? system;
}
/** The choice to save after a tap; null removes it (back to following the system). */
export function nextReducedMotionChoice(saved: boolean | null, system: boolean): boolean | null {
  const next = !effectiveReducedMotion(saved, system);
  return next === system ? null : next;
}
export function readReducedMotionChoice(store: MotionPreferenceStore | null): boolean | null {
  try {
    const value = store?.getItem(REDUCED_MOTION_KEY) ?? null;
    return value === "on" ? true : value === "off" ? false : null;
  } catch {
    return null;
  }
}
/** Best effort: a blocked storage keeps the choice for the visit only. */
export function writeReducedMotionChoice(store: MotionPreferenceStore | null, choice: boolean | null): void {
  try {
    if (choice === null) store?.removeItem(REDUCED_MOTION_KEY);
    else store?.setItem(REDUCED_MOTION_KEY, choice ? "on" : "off");
  } catch {
    // The page keeps the choice in memory.
  }
}
