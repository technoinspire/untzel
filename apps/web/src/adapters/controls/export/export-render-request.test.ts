// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { Program } from "@untzel/core";
import type { ExportPlan, ExportQuality, PlanResult } from "@untzel/export";
import { describe, expect, it } from "vitest";
import { renderRequest, type RenderAsk } from "./export-render-request";
import type { ExportTitleText } from "../export-sheet/export-title";

const program = { sourceHash: 9 } as Program;
const planned = (quality: ExportQuality): PlanResult => ({ ok: true, plan: { quality } as unknown as ExportPlan });
const title = { text: "Night", fileStem: "night" } as ExportTitleText;
const ask = (changes: Partial<RenderAsk> = {}): RenderAsk => ({
  program,
  format: "video",
  quality: "hd",
  isProbed: () => true,
  plan: planned,
  keyFor: (sourceHash, quality) => `${sourceHash}|${quality}`,
  title: () => title,
  isKept: () => false,
  refusal: () => "Too long",
  emptyRange: "Nothing to export",
  ...changes,
});

describe("renderRequest", () => {
  it("renders the plan under its key, with no fallback at HD", () => {
    expect(renderRequest(ask())).toEqual({ kind: "render", key: "9|hd", plan: { quality: "hd" }, program, title, fallback: null });
  });
  it("asks for nothing when the file is kept", () => {
    expect(renderRequest(ask({ isKept: (key) => key === "9|hd" }))).toEqual({ kind: "kept" });
  });
  it("refuses a plan that cannot render, and a text that does not play", () => {
    expect(renderRequest(ask({ plan: () => ({ ok: false, reason: "TOO_LONG", maxSeconds: 60 }) as PlanResult }))).toEqual({ kind: "refused", message: "Too long" });
    expect(renderRequest(ask({ program: null }))).toEqual({ kind: "refused", message: "Nothing to export" });
  });
  it("4K of a video before the first probe carries the HD job it may fall back to", () => {
    const request = renderRequest(ask({ quality: "4k", isProbed: () => false }));
    expect(request).toMatchObject({ kind: "render", key: "9|4k", fallback: { kind: "render", key: "9|hd", plan: { quality: "hd" } } });
    expect(renderRequest(ask({ quality: "4k", isProbed: () => true }))).toMatchObject({ fallback: null });
    expect(renderRequest(ask({ quality: "4k", format: "audio", isProbed: () => false }))).toMatchObject({ fallback: null });
  });
});
