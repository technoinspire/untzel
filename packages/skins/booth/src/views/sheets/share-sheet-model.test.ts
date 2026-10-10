// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ShareView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/strings";
import { shareSheetModel } from "./share-sheet-model";

const ready: ShareView = {
  link: { kind: "ready", url: "https://app.untzel.com/#v1.abc", length: 42 },
  isLastValid: false,
  canShareLink: true,
  canShareFile: true,
  isCopied: false,
  isCopyRefused: false,
};

describe("shareSheetModel", () => {
  it("on a phone with navigator.share, Share link is the primary", () => {
    const model = shareSheetModel(ready, false);
    expect(model.linkPrimary).toBe("share-link");
    expect([model.isLinkShown, model.url, model.lengthText]).toEqual([true, ready.link.kind === "ready" ? ready.link.url : "", strings.linkLength(42)]);
    expect(model.isSaveFilePrimary).toBe(false);
  });

  it("on desktop or without navigator.share, Copy link is the primary", () => {
    expect(shareSheetModel(ready, true).linkPrimary).toBe("copy-link");
    const noShare = shareSheetModel({ ...ready, canShareLink: false }, false);
    expect([noShare.linkPrimary, noShare.isShareLinkShown]).toEqual(["copy-link", false]);
  });

  it("too long for a link: no field, the note says why, Save file is the primary", () => {
    const model = shareSheetModel({ ...ready, link: { kind: "too-long", length: 9_000 } }, false);
    expect([model.isLinkShown, model.noteText, model.isSaveFilePrimary]).toEqual([false, strings.tooLongForLink, true]);
  });

  it("confirms the copy, flags the last valid text and hides Share file where files do not share", () => {
    const model = shareSheetModel({ ...ready, isCopied: true, isLastValid: true, canShareFile: false }, true);
    expect([model.copyLinkText, model.isLastValidShown, model.isShareFileShown]).toEqual([strings.linkCopied, true, false]);
  });
});
