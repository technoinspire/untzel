// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { fileActions } from "./share-sheet";
import { shareSheetModel } from "./share-sheet-model";
const share = {
  link: { kind: "too-long", length: 90_000 },
  isLastValid: false,
  canShareLink: true,
  canShareFile: true,
  isCopied: false,
  isCopyRefused: false,
} as const;
describe("the Share sheet's file actions", () => {
  it("has no Open file: opening is the menu's", () => {
    expect(fileActions({ isShareFileShown: true })).toEqual(["Save file", "Share file"]);
    expect(fileActions({ isShareFileShown: false })).toEqual(["Save file"]);
  });
  it("makes Save file the primary when the song does not fit in a link", () => {
    expect(shareSheetModel(share, false).isSaveFilePrimary).toBe(true);
  });
});
