// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The one source of reduced motion: the choice saved on this device, else
// the system's prefers-reduced-motion, forced on by the test page flag. It alone reads
// the key and the media query; it publishes data-motion on the root before the first
// paint and on every change, and tells the shell, the stage and the export.
import { effectiveReducedMotion, nextReducedMotionChoice, readReducedMotionChoice, writeMotionAttribute, writeReducedMotionChoice, type MotionChoice, type MotionPreferenceStore } from "@untzel/skin-contract";

/** What the page reads of the media query; a MediaQueryList satisfies it. */
export interface SystemMotion {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
}

export interface MotionSettingOptions {
  readonly doc: Document;
  readonly store: MotionPreferenceStore | null;
  /** matchMedia("(prefers-reduced-motion: reduce)"); null where it does not exist. */
  readonly system: SystemMotion | null;
  /** The page flag ?motion=reduce of the test build: always reduced. */
  readonly isForced: boolean;
}

/** MotionChoice for the shell, the same object for the stage and the export. */
export type MotionSetting = MotionChoice;

export function createMotionSetting(options: MotionSettingOptions): MotionSetting {
  let saved = readReducedMotionChoice(options.store);
  const listeners = new Set<() => void>();
  const system = (): boolean => options.system?.matches ?? false;
  const effective = (): boolean => options.isForced || effectiveReducedMotion(saved, system());
  let shown = { isReduced: effective(), isFollowing: saved === null };
  writeMotionAttribute(options.doc, shown.isReduced);
  const changed = (): void => {
    const next = { isReduced: effective(), isFollowing: saved === null };
    if (next.isReduced === shown.isReduced && next.isFollowing === shown.isFollowing) return;
    shown = next;
    writeMotionAttribute(options.doc, next.isReduced);
    for (const listener of listeners) listener();
  };
  // With a saved choice the system's change shows nothing: the choice wins.
  options.system?.addEventListener("change", changed);
  return {
    isReduced: () => shown.isReduced,
    isFollowingSystem: () => shown.isFollowing,
    toggle() {
      saved = nextReducedMotionChoice(saved, system());
      writeReducedMotionChoice(options.store, saved);
      changed();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
