// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import * as language from "@untzel/language";
import { describe, expect, it } from "vitest";
import type { ArrangementSourceEditor, SourceEditor, StatementSourceEditor } from "./ports";

// The composition binds @untzel/language's edit functions to SourceEditor one to one; only
// addTrack needs the registry to turn an instrument name into its manifest. This test
// fails to compile if the two drift apart.
const bound: Omit<SourceEditor, "addTrack"> & ArrangementSourceEditor & StatementSourceEditor = {
  setTrackMuted: language.setTrackMuted,
  dropEdit: language.dropEdit,
  toggleLoopMember: language.toggleLoopMember,
  setTrackParameter: language.setTrackParameter,
  toggleStep: language.toggleStep,
  setStepPitch: language.setStepPitch,
  setTrackFree: language.setTrackFree,
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
  removeTrackParameters: language.removeTrackParameters,
  setTempo: language.setTempo,
  setKey: language.setKey,
};

describe("SourceEditor over @untzel/language", () => {
  it("binds the language edits without adapters", () => {
    const edit = bound.setTrackMuted("kick: kick x...\n", "kick", true);
    expect(edit.ok).toBe(true);
    if (edit.ok) expect(edit.source).toContain("mute");
  });
});
