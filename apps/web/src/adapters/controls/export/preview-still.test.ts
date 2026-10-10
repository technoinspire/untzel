// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreviewStill } from "./preview-still";

/** A still source whose answers the test releases one by one. */
function deferredSource() {
  const pending: Array<(blob: Blob | null) => void> = [];
  const sizes: Array<{ readonly width: number; readonly height: number }> = [];
  const source = (size: { readonly width: number; readonly height: number }) => {
    sizes.push(size);
    return new Promise<Blob | null>((resolve) => pending.push(resolve));
  };
  return { source, sizes, answer: (index: number, blob: Blob | null) => pending[index]?.(blob) };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("PreviewStill", () => {
  let created = 0;
  const revoked: string[] = [];
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:still-${(created += 1)}`);
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => void revoked.push(url));
  afterEach(() => {
    revoked.length = 0;
  });

  it("asks at 0.4 × the HD frame of the format and shows the still only for that format", async () => {
    const { source, sizes, answer } = deferredSource();
    const onChange = vi.fn();
    const still = new PreviewStill(source, onChange);
    still.request("story");
    expect(sizes).toEqual([{ width: 432, height: 768 }]);
    answer(0, new Blob(["x"]));
    await flush();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(still.urlFor("story")).toMatch(/^blob:/);
    expect(still.urlFor("video")).toBeNull();
  });

  it("drops a late answer to an earlier request, revokes the replaced URL and asks nothing for audio", async () => {
    const { source, sizes, answer } = deferredSource();
    const still = new PreviewStill(source, () => undefined);
    still.request("story");
    answer(0, new Blob(["story"]));
    await flush();
    const story = still.urlFor("story");
    still.request("video");
    still.request("story");
    answer(1, new Blob(["late video"]));
    await flush();
    expect(still.urlFor("video")).toBeNull();
    answer(2, new Blob(["story again"]));
    await flush();
    expect(revoked).toEqual([story]);
    still.request("audio");
    expect(sizes).toHaveLength(3);
  });

  it("clear revokes the URL and ignores an answer still in flight", async () => {
    const { source, answer } = deferredSource();
    const still = new PreviewStill(source, () => undefined);
    still.request("video");
    answer(0, new Blob(["video"]));
    await flush();
    const url = still.urlFor("video");
    still.request("video");
    still.clear();
    expect(revoked).toEqual([url]);
    answer(1, new Blob(["late"]));
    await flush();
    expect(still.urlFor("video")).toBeNull();
  });
});
