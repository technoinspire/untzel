// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ExportPreviewLayout } from "@untzel/presentation/view-model";
import { previewVars, stillSource } from "./export-preview";

const layout: ExportPreviewLayout = {
  aspect: 16 / 9,
  scrim: { left: 0.37, top: 0.6927, width: 0.2604, height: 0.163 },
  scrimRadius: 0.0146,
  markLogo: { left: 0.436, top: 0.72, width: 0.1286, height: 0.0667 },
  markUrl: { top: 0.776, size: 0.0167, center: 0.825 },
  ringsClearance: { centerX: 0.5, centerY: 0.5, inner: 0.23729, outer: 0.24563 },
  cardLogo: { left: 0.333, top: 0.46, width: 0.3333, height: 0.1722 },
  cardUrl: { top: 0.66, size: 0.0229, center: 0.5 },
};

describe("previewVars", () => {
  it("turns the file's layout into the custom properties the stylesheet reads, rounded", () => {
    const vars = previewVars(layout);
    expect(vars["--frame-ratio"]).toBe("1.778");
    expect(vars["--scrim-left"]).toBe("37%");
    expect(vars["--scrim-top"]).toBe("69.27%");
    expect(vars["--scrim-radius"]).toBe("1.46cqw");
    expect(vars["--mark-url-size"]).toBe("1.67cqw");
    expect(vars["--mark-url-center"]).toBe("82.5%");
    expect(vars["--card-logo-width"]).toBe("33.33%");
    expect(vars["--rings-x"]).toBe("50%");
    expect(vars["--rings-inner"]).toBe("23.729cqw");
    expect(vars["--rings-outer"]).toBe("24.563cqw");
  });
  it("without a clearance (the story), a cut of radius 0: the glow stays whole", () => {
    const vars = previewVars({ ...layout, ringsClearance: null });
    expect([vars["--rings-inner"], vars["--rings-outer"]]).toEqual(["0cqw", "0cqw"]);
  });

  it("sets every property the preview uses, and nothing else", () => {
    expect(Object.keys(previewVars(layout))).toHaveLength(22);
  });
});
describe("stillSource", () => {
  it("shows the scene's still in Story and Video, nothing for Audio or before it arrives", () => {
    expect(stillSource({ format: "story", previewStill: "blob:still" })).toBe("blob:still");
    expect(stillSource({ format: "video", previewStill: "blob:still" })).toBe("blob:still");
    expect(stillSource({ format: "audio", previewStill: "blob:still" })).toBeNull();
    expect(stillSource({ format: "story", previewStill: null })).toBeNull();
  });
});
