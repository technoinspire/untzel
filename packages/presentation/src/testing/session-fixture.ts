// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the presenters' unit tests read: a real session over the registry the test passes in
// (registryWith, from @untzel/instrument-index/testing) and the language it binds, and words
// that show where each label came from. Test-only ("testing-only-in-tests").
import type { InstrumentRegistry } from "@untzel/core";
import { Session, type SessionDependencies, type SessionView } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import type { InstrumentDescriptions, ParameterLabels } from "../presentation-copy";
export interface SessionFixture {
  readonly registry: InstrumentRegistry;
  /** A session that has applied `source`, its sound port faked. */
  sessionOf(source: string): { readonly session: Session; readonly sound: FakeSoundPort };
  viewOf(source: string): SessionView;
}
/** `analyzeWith` binds the language's analyze to the registry (the composition's job). */
export function sessionFixture(registry: InstrumentRegistry, analyzeWith: (registry: InstrumentRegistry) => SessionDependencies["analyze"]): SessionFixture {
  const analyze = analyzeWith(registry);
  function sessionOf(source: string) {
    const sound = new FakeSoundPort();
    const session = new Session({ sound, load: new FakeLoadPort(), log: new FakeDiagnosticsLog(), analyze });
    session.applyText(source);
    return { session, sound };
  }
  return { registry, sessionOf, viewOf: (source) => sessionOf(source).session.view() };
}
export const FAKE_LABELS: ParameterLabels = {
  panCenter: "center",
  panLeft: (percent) => `left ${percent}`,
  panRight: (percent) => `right ${percent}`,
  signalOver: (shape, bars, range) => `${shape} ${bars} bars · ${range}`,
  gainRange: (low, high) => `${low} to ${high}`,
};
export const FAKE_DESCRIPTIONS: InstrumentDescriptions = {
  instrumentDescription: (instrument, english) => `${instrument}: ${english}`,
  soundDescription: (instrument, sound, english) => `${instrument} ${sound}: ${english}`,
};
