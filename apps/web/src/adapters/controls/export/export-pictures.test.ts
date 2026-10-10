// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ExportPlan } from "@untzel/export";
import { describe, expect, it, vi } from "vitest";
import { prepareExportPictures } from "./export-pictures";
const fonts = { load: async () => [], check: () => true };
const title = { text: "Night Drive", detail: "124 BPM · a minor", fileStem: "night-drive" };
const video = { frame: { width: 1080, height: 1920 } } as unknown as ExportPlan;
const audio = { frame: null } as unknown as ExportPlan;
function bitmap() {
  return { close: vi.fn() };
}
function api(branding: boolean, overlays: boolean) {
  const mark = bitmap();
  const card = bitmap();
  const parts = { mark, card, titleCard: bitmap(), caption: bitmap() };
  const fake = {
    prepareVideoBranding: vi.fn(async () => (branding ? { ok: true, branding: { mark, card } } : { ok: false, reason: "font" })),
    prepareTitleOverlays: vi.fn(async () => (overlays ? { ok: true, overlays: { card: parts.titleCard, caption: parts.caption } } : { ok: false, reason: "font" })),
  };
  return { fake: fake as unknown as Parameters<typeof prepareExportPictures>[0], calls: fake, parts };
}
describe("prepareExportPictures", () => {
  it("audio carries no pictures and draws nothing", async () => {
    const { fake, calls } = api(true, true);
    expect(await prepareExportPictures(fake, fonts, "logo.png", audio, title)).toBeNull();
    expect(calls.prepareVideoBranding).not.toHaveBeenCalled();
  });
  it("a mark that cannot be drawn means no video, and the title is not tried", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fake, calls } = api(false, true);
    expect(await prepareExportPictures(fake, fonts, "logo.png", video, title)).toBeUndefined();
    expect(calls.prepareTitleOverlays).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it("a title that cannot be drawn means no video, and closes the mark and the card", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { fake, parts } = api(true, false);
    expect(await prepareExportPictures(fake, fonts, "logo.png", video, title)).toBeUndefined();
    expect(parts.mark.close).toHaveBeenCalled();
    expect(parts.card.close).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("export: title font unavailable");
    warn.mockRestore();
  });
  it("gives both on success, with the title's text and detail", async () => {
    const { fake, calls, parts } = api(true, true);
    const pictures = await prepareExportPictures(fake, fonts, "logo.png", video, title);
    expect(pictures?.title).toEqual({ card: parts.titleCard, caption: parts.caption });
    expect(calls.prepareTitleOverlays).toHaveBeenCalledWith({ fonts, frame: video.frame, title: "Night Drive", detail: "124 BPM · a minor" });
  });
});
