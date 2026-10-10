// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import { CommandHistory } from "./history";

describe("terminal history", () => {
  it("walks back and forward, giving the draft back", () => {
    const history = new CommandHistory();
    history.push("add bass");
    history.push("tempo 124");
    expect(history.previous("mu")).toBe("tempo 124");
    expect(history.previous("tempo 124")).toBe("add bass");
    expect(history.previous("add bass")).toBeNull();
    expect(history.next()).toBe("tempo 124");
    expect(history.next()).toBe("mu");
    expect(history.next()).toBeNull();
  });

  it("keeps a repeated line once, skips blanks and keeps the limit", () => {
    const history = new CommandHistory(3);
    for (const line of ["play", "play", "  ", "stop", "drop", "undo"]) history.push(line);
    expect(history.size).toBe(3);
    expect(history.previous("")).toBe("undo");
    expect(history.previous("")).toBe("drop");
    expect(history.previous("")).toBe("stop");
    expect(history.previous("")).toBeNull();
  });
});
