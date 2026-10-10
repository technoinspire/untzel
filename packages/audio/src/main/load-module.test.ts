// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { afterEach, describe, expect, it, vi } from "vitest";
import { compileDsp } from "./load-module";

/** The smallest valid module: the magic number and version 1. */
const EMPTY_MODULE = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);
const URL = "/assets/untzel_dsp.wasm";

afterEach(() => vi.unstubAllGlobals());

describe("compileDsp", () => {
  it("uses the compile begun at page load as it is", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const started = await WebAssembly.compile(EMPTY_MODULE);
    expect(await compileDsp(URL, Promise.resolve(started))).toBe(started);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("falls back to compile(arrayBuffer) when the early compile fails with a TypeError (wrong MIME)", async () => {
    const fetch = vi.fn(async () => new Response(EMPTY_MODULE, { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const module = await compileDsp(URL, Promise.reject(new TypeError("Incorrect response MIME type")));
    expect(module).toBeInstanceOf(WebAssembly.Module);
    expect(fetch).toHaveBeenCalledWith(URL);
  });
  it("rejects with the status when the fallback's fetch is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    await expect(compileDsp(URL, Promise.reject(new TypeError("HTTP status code is not ok")))).rejects.toThrow(`Untzel DSP fetch failed: 404 ${URL}`);
  });
  it("passes any other failure on", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await expect(compileDsp(URL, Promise.reject(new RangeError("out of memory")))).rejects.toThrow(RangeError);
  });
});
