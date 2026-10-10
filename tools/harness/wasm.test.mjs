// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { absolutePaths } from "./wasm.mjs";

// Built from parts so that a scan of the repository does not read the fixtures as real paths.
const MAC = ["", "Users", "someone", "untzel", "instruments", "strings", "voice.rs"].join("/");
const LINUX = ["", "home", "runner", "work", "untzel", "voice.rs"].join("/");
const WINDOWS = ["C:", "build", "untzel", "voice.rs"].join("\\");
/** A binary with the text between two runs of other bytes, as a data section holds it. */
const binary = (text) => new Uint8Array([0, 97, 115, 109, 0, ...Buffer.from(text, "latin1"), 0, 255, 1]);

describe("absolutePaths", () => {
  it("finds a macOS, a Linux and a Windows build path, each up to the end of its string", () => {
    expect(absolutePaths(binary(MAC))).toEqual([MAC]);
    expect(absolutePaths(binary(LINUX))).toEqual([LINUX]);
    expect(absolutePaths(binary(WINDOWS))).toEqual([WINDOWS]);
  });

  it("accepts the remapped path and the Rust library's own", () => {
    expect(absolutePaths(binary("untzel/packages/dsp/../../instruments/strings/voice.rs"))).toEqual([]);
    expect(absolutePaths(binary("/rustc/0123456789abcdef/library/core/src/panicking.rs"))).toEqual([]);
  });

  it("does not read a drive letter without a folder after it as a path", () => {
    expect(absolutePaths(binary("Q:\\x"))).toEqual([]);
  });
});
