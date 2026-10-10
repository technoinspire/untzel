// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { PreferenceStore } from "./collapse";
import { readPreviewSounds, writePreviewSounds } from "./preview-preference";
// The one source of "Preview sounds": the switch in the track detail and
// the one in the menu are two views of it, so turning one changes the other and the
// sound at once. Read once from the device; with no storage it lasts the visit.
export interface PreviewSoundsSetting {
  isOn(): boolean;
  set(isOn: boolean): void;
  onChange(listener: () => void): () => void;
}
export function createPreviewSoundsSetting(store: PreferenceStore | null): PreviewSoundsSetting {
  let value = readPreviewSounds(store);
  const listeners = new Set<() => void>();
  return {
    isOn: () => value,
    set(isOn) {
      if (isOn === value) return;
      value = isOn;
      writePreviewSounds(store, isOn);
      for (const listener of listeners) listener();
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
