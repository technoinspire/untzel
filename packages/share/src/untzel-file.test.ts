// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createRegistry } from "@untzel/core";
import { analyze } from "@untzel/language";
import { describe, expect, it } from "vitest";
import { MAX_SOURCE_BYTES } from "./link";
import {
  FORMAT_LINE,
  MAX_FILE_BYTES,
  isUntzelCandidate,
  readUntzelFile,
  untzelFileName,
  untzelFileText,
} from "./untzel-file";

const blob = (parts: BlobPart[]) => new Blob(parts);

describe("the .untzel file", () => {
  it("starts with the format line once and reads back without it", async () => {
    const text = untzelFileText("tempo 120\n", null, null);
    expect(text.startsWith(FORMAT_LINE)).toBe(true);
    expect(text.indexOf(FORMAT_LINE, 1)).toBe(-1);
    expect(await readUntzelFile(blob([text]))).toEqual({ ok: true, source: "tempo 120\n", formatVersion: 1, mode: null, range: null });
  });

  it("carries the sender's mode on the format line, never in the text", async () => {
    for (const mode of ["loop", "song"] as const) {
      const text = untzelFileText("tempo 120\n", mode, null);
      expect(text).toBe(`// untzel 1 mode=${mode}\ntempo 120\n`);
      expect(await readUntzelFile(blob([text]))).toEqual({ ok: true, source: "tempo 120\n", formatVersion: 1, mode, range: null });
    }
  });

  it("a format line with an unknown parameter or mode opens without a mode", async () => {
    expect(await readUntzelFile(blob(["// untzel 1 mode=dance\ntempo 120"]))).toEqual({ ok: true, source: "tempo 120", formatVersion: 1, mode: null, range: null });
    expect(await readUntzelFile(blob(["// untzel 1 by=app mode=song\ntempo 120"]))).toMatchObject({ source: "tempo 120", mode: "song", range: null });
  });

  it("carries the play range on the format line beside the mode", async () => {
    const range = { startBar: 9, endBar: 28, cycle: false };
    const text = untzelFileText("tempo 120\n", "song", range);
    expect(text).toBe("// untzel 1 mode=song range=9-28 cycle=off\ntempo 120\n");
    expect(await readUntzelFile(blob([text]))).toEqual({ ok: true, source: "tempo 120\n", formatVersion: 1, mode: "song", range });
    expect(untzelFileText("tempo 120\n", "loop", { startBar: 2, endBar: 3, cycle: true })).toBe("// untzel 1 mode=loop range=2-3\ntempo 120\n");
    expect(untzelFileText("tempo 120\n", null, range)).toBe("// untzel 1\ntempo 120\n");
  });

  it("a malformed range leaves the range out and the text whole", async () => {
    expect(await readUntzelFile(blob(["// untzel 1 mode=song range=28-9\ntempo 120"]))).toEqual({ ok: true, source: "tempo 120", formatVersion: 1, mode: "song", range: null });
    expect(await readUntzelFile(blob(["// untzel 1 mode=song range=x\ntempo 120"]))).toMatchObject({ source: "tempo 120", range: null });
  });

  it("the longest format line fits the file's room for it", () => {
    const line = untzelFileText("", "song", { startBar: 1000, endBar: 1024, cycle: false });
    expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(MAX_FILE_BYTES - MAX_SOURCE_BYTES - 3);
  });

  it("does not accumulate format lines when what was opened is saved again", async () => {
    let source = "tempo 120\n";
    for (let round = 0; round < 3; round += 1) {
      const read = await readUntzelFile(blob([untzelFileText(source, "loop", null)]));
      if (!read.ok) throw new Error("read failed");
      source = read.source;
    }
    expect(source).toBe("tempo 120\n");
  });

  it("reports the format version, or null without the line", async () => {
    expect(await readUntzelFile(blob(["// untzel 2\ntempo 120"]))).toMatchObject({ formatVersion: 2 });
    expect(await readUntzelFile(blob(["tempo 120"]))).toEqual({ ok: true, source: "tempo 120", formatVersion: null, mode: null, range: null });
  });

  it("round-trips a text of exactly the language limit in 3-byte units", async () => {
    const source = "\u20ac".repeat(65_536);
    const file = blob([untzelFileText(source, "song", null)]);
    expect(file.size).toBe(196_630);
    expect(file.size).toBeLessThanOrEqual(MAX_FILE_BYTES);
    const read = await readUntzelFile(file);
    expect(read).toEqual({ ok: true, source, formatVersion: 1, mode: "song", range: null });
    const analyzed = analyze(read.ok ? read.source : "", createRegistry([]));
    if (!analyzed.ok) expect(analyzed.diagnostics.map((d) => d.code)).not.toContain("SOURCE_TOO_LONG");
  });

  it("removes a BOM and CRLF line endings", async () => {
    const read = await readUntzelFile(blob([new Uint8Array([0xef, 0xbb, 0xbf]), "// untzel 1\r\ntempo 120\r\nkey c minor\r\n"]));
    expect(read).toEqual({ ok: true, source: "tempo 120\nkey c minor\n", formatVersion: 1, mode: null, range: null });
  });

  it("rejects a file above the size limit without reading it", async () => {
    const big = blob([new Uint8Array(MAX_FILE_BYTES + 1)]);
    let read = false;
    const spy = Object.assign(big, {
      arrayBuffer: () => {
        read = true;
        return Promise.resolve(new ArrayBuffer(0));
      },
    });
    expect(await readUntzelFile(spy)).toEqual({ ok: false, reason: "TOO_LARGE" });
    expect(read).toBe(false);
  });

  it("rejects empty files, invalid UTF-8 and a text above the limit", async () => {
    expect(await readUntzelFile(blob([]))).toEqual({ ok: false, reason: "EMPTY" });
    expect(await readUntzelFile(blob([FORMAT_LINE]))).toEqual({ ok: false, reason: "EMPTY" });
    expect(await readUntzelFile(blob([new Uint8Array([0x74, 0xff, 0x80])]))).toEqual({ ok: false, reason: "NOT_TEXT" });
    expect(await readUntzelFile(blob(["a".repeat(65_537)]))).toEqual({ ok: false, reason: "TOO_LARGE" });
  });

  it("names files by local date and time", () => {
    expect(untzelFileName(null, new Date(2026, 9, 3, 9, 5))).toBe("untzel-20261003-0905.untzel");
    expect(untzelFileName("", new Date(2026, 9, 3, 9, 5))).toBe("untzel-20261003-0905.untzel");
    expect(untzelFileName("midnight-coast", new Date(2026, 9, 3, 9, 5))).toBe("midnight-coast.untzel");
  });

  it("accepts .untzel and text files only", () => {
    expect(isUntzelCandidate({ name: "Song.UNTZEL", type: "" })).toBe(true);
    expect(isUntzelCandidate({ name: "notes.txt", type: "text/plain" })).toBe(true);
    expect(isUntzelCandidate({ name: "photo.png", type: "image/png" })).toBe(false);
  });
});
