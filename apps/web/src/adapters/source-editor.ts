// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { InstrumentRegistry } from "@untzel/core";
import * as language from "@untzel/language";
import type {
  ArrangementSourceEditor,
  PatternSourceEditor,
  SoundEditor,
  SourceEditor,
  StatementSourceEditor,
} from "@untzel/session";

/** The session's text-edit ports over the edits of @untzel/language; the manifest-aware ones resolve it from the registry. */
// Over 40 lines: one literal of the edit ports, an edit per entry; the manifest-aware ones resolve it first.
export function languageSourceEditor(registry: InstrumentRegistry): SourceEditor & ArrangementSourceEditor & StatementSourceEditor & PatternSourceEditor {
  return {
    setTrackMuted: language.setTrackMuted,
    dropEdit: language.dropEdit,
    toggleLoopMember: language.toggleLoopMember,
    setTrackParameter: language.setTrackParameter,
    toggleStep: language.toggleStep,
    setStepPitch: language.setStepPitch,
    setTrackFree: language.setTrackFree,
    addTrack(source, instrument, sound, pattern, key) {
      const manifest = registry.get(instrument);
      if (manifest === undefined) return { ok: false, reason: "UNKNOWN_INSTRUMENT" };
      const named = pattern === null ? null : manifest.patterns.find((entry) => entry.name === pattern);
      if (named === undefined) return { ok: false, reason: "INVALID_NAME" };
      return language.addTrack(source, manifest, sound, named, key);
    },
    removeTrackParameters: language.removeTrackParameters,
    setTrackPattern(source, track, instrument, pattern, key) {
      const manifest = registry.get(instrument);
      const named = manifest?.patterns.find((entry) => entry.name === pattern);
      if (manifest === undefined) return { ok: false, reason: "UNKNOWN_INSTRUMENT" };
      if (named === undefined) return { ok: false, reason: "INVALID_NAME" };
      return language.setTrackPattern(source, track, manifest, named, key);
    },
    duplicateTrack: language.duplicateTrack,
    renameTrack: language.renameTrack,
    deleteTrack: language.deleteTrack,
    setSectionMembership: language.setSectionMembership,
    setLoopBars: language.setLoopBars,
    setTrackBars: language.setTrackBars,
    setStepCount: language.setStepCount,
    readBar: language.readBar,
    replaceBar: language.replaceBar,
    clearBar: language.clearBar,
    setPartBars: language.setPartBars,
    movePart: language.movePart,
    duplicatePart: language.duplicatePart,
    declareSong: language.declareSong,
    addSection: language.addSection,
    renameSection: language.renameSection,
    setTempo: language.setTempo,
    setKey: language.setKey,
  };
}

/** The sound group's edits; setSound resolves the manifest, the rest bind one to one. */
export function languageSoundEditor(registry: InstrumentRegistry): SoundEditor {
  return {
    setSound(source, track, instrument, sound) {
      const manifest = registry.get(instrument);
      return manifest === undefined ? { ok: false, reason: "UNKNOWN_INSTRUMENT" } : language.setSound(source, track, manifest, sound);
    },
    addEffect: language.addEffect,
    removeEffect: language.removeEffect,
    setInstrument(source, track, instrument, preset) {
      const manifest = registry.get(instrument);
      return manifest === undefined ? { ok: false, reason: "UNKNOWN_INSTRUMENT" } : language.setInstrument(source, track, manifest, preset);
    },
  };
}
