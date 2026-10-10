// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { InterfaceChange } from "@untzel/editor";
import { analyze } from "@untzel/language";
import { Session } from "@untzel/session";
import { FakeDiagnosticsLog, FakeLoadPort, FakeSoundPort } from "@untzel/session/testing";
import { describe, expect, it } from "vitest";
import { buildRegistry } from "@untzel/instrument-index";
import { SessionCodePort, SoundingFeed } from "./code-port";

// What the editor reads from the session: the warnings of a valid text, the
// errors of an invalid one, and the source of the program that is sounding.

const { registry } = buildRegistry();
const VALID = "kick x... | gain 0.5 | gain 0.6";
const INVALID = "kick x... ]";

function setup(): { session: Session; port: SessionCodePort } {
  const session = new Session({
    sound: new FakeSoundPort(),
    load: new FakeLoadPort(),
    log: new FakeDiagnosticsLog(),
    analyze: (text) => analyze(text, registry),
  });
  const changes = { lastChange: (): InterfaceChange | null => null, onInterfaceChange: () => () => undefined };
  return { session, port: new SessionCodePort(session, changes, new SoundingFeed(() => 0)) };
}

describe("SessionCodePort", () => {
  it("a valid text: its warnings, with the program on the same text", () => {
    const { session, port } = setup();
    session.applyText(VALID);
    const state = port.code();
    expect(state.source).toBe(VALID);
    expect(state.programSource).toBe(VALID);
    expect(state.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity])).toEqual([["DUPLICATE_MODIFIER", "warning"]]);
  });

  it("an invalid text after a valid one: its errors, and the program still on the valid text", () => {
    const { session, port } = setup();
    session.applyText(VALID);
    const states: string[] = [];
    const unsubscribe = port.subscribe((state) => states.push(state.programSource));
    session.applyText(INVALID);
    const state = port.code();
    expect(state.source).toBe(INVALID);
    expect(state.programSource).toBe(VALID);
    expect(state.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity])).toEqual([["SYNTAX_ERROR", "error"]]);
    expect(states).toEqual([VALID]);
    unsubscribe();
  });
});
