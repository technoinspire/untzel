// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { readFileSync, readdirSync } from "node:fs";
import { analyze } from "@untzel/language";
import fc from "fast-check";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { encodeBase64url } from "./base64url";
import { deflateRaw, inflateBounded } from "./bounded-inflate";
import { LINKS_V1 } from "./fixtures/links-v1";
import {
  MAX_PARAMS_LENGTH,
  MAX_PAYLOAD_LENGTH,
  MAX_SOURCE_BYTES,
  SAFE_LINK_LENGTH,
  decodeFragment,
  encodeLink,
} from "./link";

const PAGE = "https://app.untzel.com/";
// The whole library: the templates that ship use it, and a link carries any of them.
const registry = registryWith();

async function payloadOf(bytes: Uint8Array): Promise<string> {
  return encodeBase64url(await deflateRaw(bytes));
}

function hashOf(url: string): string {
  return url.slice(url.indexOf("#"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("encodeLink and decodeFragment", () => {
  it("round-trips any well-formed text, accents and emoji included", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ unit: "grapheme", maxLength: 600 }), async (source) => {
        const link = await encodeLink(source, PAGE, null, null);
        if (link.kind !== "link") return;
        expect(await decodeFragment(hashOf(link.url))).toEqual({ ok: true, source, mode: null, range: null });
      }),
      { numRuns: 200 },
    );
  });

  it("round-trips a text of 65 536 units", async () => {
    const source = "kick: x... é 🎛 ".repeat(4096).slice(0, 65_536);
    const payload = await payloadOf(new TextEncoder().encode(source));
    expect(await decodeFragment(`#v1.${payload}`)).toEqual({ ok: true, source, mode: null, range: null });
  });

  it("carries the sender's mode after the payload and reads it back", async () => {
    for (const mode of ["loop", "song"] as const) {
      const link = await encodeLink("tempo 132\n", PAGE, mode, null);
      if (link.kind !== "link") throw new Error("too long");
      expect(link.url.endsWith(`&mode=${mode}`)).toBe(true);
      expect(await decodeFragment(hashOf(link.url))).toEqual({ ok: true, source: "tempo 132\n", mode, range: null });
    }
    const without = await encodeLink("tempo 132\n", PAGE, null, null);
    expect(without.kind === "link" && without.url.includes("&")).toBe(false);
  });

  it("ignores unknown parameters and unknown modes: the text still opens, without a mode", async () => {
    const payload = await payloadOf(new TextEncoder().encode("tempo 132\n"));
    const decoded = (params: string) => decodeFragment(`#v1.${payload}${params}`);
    expect(await decoded("&mode=dance")).toEqual({ ok: true, source: "tempo 132\n", mode: null, range: null });
    expect(await decoded("&mode")).toEqual({ ok: true, source: "tempo 132\n", mode: null, range: null });
    expect(await decoded("&from=app&mode=song")).toEqual({ ok: true, source: "tempo 132\n", mode: "song", range: null });
    expect(await decoded("&mode=loop=x")).toEqual({ ok: true, source: "tempo 132\n", mode: null, range: null });
  });

  it("carries the play range beside its mode and reads it back", async () => {
    const range = { startBar: 9, endBar: 28, cycle: false };
    const link = await encodeLink("tempo 132\n", PAGE, "song", range);
    if (link.kind !== "link") throw new Error("too long");
    expect(link.url.endsWith("&mode=song&range=9-28&cycle=off")).toBe(true);
    expect(await decodeFragment(hashOf(link.url))).toEqual({ ok: true, source: "tempo 132\n", mode: "song", range });
    const looped = await encodeLink("tempo 132\n", PAGE, "loop", { startBar: 2, endBar: 3, cycle: true });
    expect(looped.kind === "link" && looped.url.endsWith("&mode=loop&range=2-3")).toBe(true);
    // Without a mode the range does not say which ruler it counts on: neither goes.
    const unmoded = await encodeLink("tempo 132\n", PAGE, null, range);
    expect(unmoded.kind === "link" && unmoded.url.includes("&")).toBe(false);
  });

  it("keeps the worst case of mode and range inside the parameter budget", async () => {
    const link = await encodeLink("tempo 132\n", PAGE, "song", { startBar: 1000, endBar: 1024, cycle: false });
    if (link.kind !== "link") throw new Error("too long");
    const params = link.url.slice(link.url.indexOf("&"));
    expect(params).toBe("&mode=song&range=1000-1024&cycle=off");
    expect(params.length).toBe(36);
    expect(params.length).toBeLessThanOrEqual(MAX_PARAMS_LENGTH);
  });

  it("ignores a malformed range: the text and the mode still open", async () => {
    const payload = await payloadOf(new TextEncoder().encode("tempo 132\n"));
    const decoded = (params: string) => decodeFragment(`#v1.${payload}${params}`);
    for (const params of ["&mode=song&range=28-9", "&mode=song&range=0-4", "&mode=song&range=a-b", "&mode=song&range=3", "&range=2-3"]) {
      expect(await decoded(params)).toMatchObject({ ok: true, source: "tempo 132\n", range: null });
    }
    expect(await decoded("&cycle=off&from=app&range=5-8&mode=song")).toEqual({
      ok: true,
      source: "tempo 132\n",
      mode: "song",
      range: { startBar: 5, endBar: 8, cycle: false },
    });
  });

  it("rejects parameters longer than the limit without decompressing", async () => {
    const payload = await payloadOf(new TextEncoder().encode("tempo 132\n"));
    const spy = vi.spyOn(globalThis, "DecompressionStream");
    const params = `&mode=loop&${"x".repeat(MAX_PARAMS_LENGTH)}`;
    expect(await decodeFragment(`#v1.${payload}${params}`)).toEqual({ ok: false, reason: "BAD_PAYLOAD" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("builds the URL on the page address and reports its length", async () => {
    const link = await encodeLink("tempo 132\n", PAGE, "loop", null);
    expect(link.kind).toBe("link");
    if (link.kind !== "link") return;
    expect(link.url.startsWith(`${PAGE}#v1.`)).toBe(true);
    expect(link.length).toBe(link.url.length);
  });

  it("is too long above the safe length", async () => {
    let seed = 1;
    const noise = Array.from({ length: 9_000 }, () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return String.fromCharCode(33 + (seed % 90));
    }).join("");
    const link = await encodeLink(noise, PAGE, null, null);
    expect(link.kind).toBe("too-long");
    expect(link.length).toBeGreaterThan(SAFE_LINK_LENGTH);
  });

  it("decodes every frozen v1 link to its template, which analyzes to the same program", async () => {
    for (const frozen of LINKS_V1) {
      const decoded = await decodeFragment(`#${frozen.fragment}`);
      // Frozen before links carried the mode: no mode, and the receiver falls back.
      expect(decoded).toEqual({ ok: true, source: frozen.source, mode: null, range: null });
      const fromLink = analyze(decoded?.ok === true ? decoded.source : "", registry);
      const fromText = analyze(frozen.source, registry);
      expect(fromLink.ok).toBe(true);
      if (fromLink.ok && fromText.ok) expect(fromLink.program.sourceHash).toBe(fromText.program.sourceHash);
    }
  });

  it("has a frozen link for every template text that ships", () => {
    const directory = new URL("../../../apps/web/src/templates/", import.meta.url);
    // Every <style>/<project>.untzel and every template at the root; the id is the path.
    for (const name of readdirSync(directory, { recursive: true, encoding: "utf8" }).filter((file) => file.endsWith(".untzel"))) {
      const text = readFileSync(new URL(name, directory), "utf8");
      const template = name.replace(/\.untzel$/, "");
      expect(LINKS_V1.some((frozen) => frozen.template === template && frozen.source === text)).toBe(true);
    }
  });
});

describe("decodeFragment rejects", () => {
  it("returns null for anything that is not an Untzel fragment", async () => {
    for (const hash of ["", "#", "#top", "#v01.abc", "#v.abc", "#v1234.abc", "#V1.abc"]) {
      expect(await decodeFragment(hash)).toBeNull();
    }
  });

  it("an unknown version", async () => {
    expect(await decodeFragment("#v2.abcd")).toEqual({ ok: false, reason: "UNKNOWN_VERSION" });
    expect(await decodeFragment("#v10.abcd")).toEqual({ ok: false, reason: "UNKNOWN_VERSION" });
  });

  it("a bad payload without decompressing it", async () => {
    const spy = vi.spyOn(globalThis, "DecompressionStream");
    const tooLong = "A".repeat(MAX_PAYLOAD_LENGTH + 1);
    for (const hash of ["#v1.", "#v1.abc$", "#v1.ab=c", "#v1.abcde", `#v1.${tooLong}`]) {
      expect(await decodeFragment(hash)).toEqual({ ok: false, reason: "BAD_PAYLOAD" });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("a decompression bomb, reading at most one block past the limit", async () => {
    const zeros = new Uint8Array(64 * 1024 * 1024);
    const compressed = await deflateRaw(zeros);
    const inflated = await inflateBounded(compressed, MAX_SOURCE_BYTES);
    expect(inflated).toMatchObject({ ok: false, reason: "TOO_LARGE" });
    if (inflated.ok) return;
    expect(inflated.read).toBeLessThanOrEqual(MAX_SOURCE_BYTES + 64 * 1024);
    expect(await decodeFragment(`#v1.${encodeBase64url(compressed)}`)).toEqual({ ok: false, reason: "TOO_LARGE" });
  });

  it("truncated payloads and garbage after the end", async () => {
    const compressed = await deflateRaw(new TextEncoder().encode("kick: x... x... x... x...\n".repeat(20)));
    const truncated = encodeBase64url(compressed.subarray(0, compressed.length - 4));
    const trailing = encodeBase64url(new Uint8Array([...compressed, 1, 2, 3]));
    expect(await decodeFragment(`#v1.${truncated}`)).toEqual({ ok: false, reason: "CORRUPT" });
    expect(await decodeFragment(`#v1.${trailing}`)).toEqual({ ok: false, reason: "CORRUPT" });
    expect(await decodeFragment("#v1.____")).toEqual({ ok: false, reason: "CORRUPT" });
  });

  it("bytes that are not UTF-8", async () => {
    const payload = await payloadOf(new Uint8Array([0x6b, 0xff, 0xfe, 0x80]));
    expect(await decodeFragment(`#v1.${payload}`)).toEqual({ ok: false, reason: "NOT_TEXT" });
  });

  it("a text longer than the language limit", async () => {
    const payload = await payloadOf(new TextEncoder().encode("a".repeat(65_537)));
    expect(await decodeFragment(`#v1.${payload}`)).toEqual({ ok: false, reason: "TOO_LARGE" });
  });
});

describe("limits", () => {
  it("the payload limit fits incompressible input at the byte limit", async () => {
    let seed = 7;
    const random = Uint8Array.from({ length: MAX_SOURCE_BYTES }, () => {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      return seed >>> 24;
    });
    const payload = await payloadOf(random);
    expect(MAX_PAYLOAD_LENGTH).toBe(262_310);
    expect(payload.length).toBeLessThanOrEqual(MAX_PAYLOAD_LENGTH);
  });
});
