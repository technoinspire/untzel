// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the Share sheet shows, decided without the DOM. One primary action:
// Copy link on desktop and where navigator.share does not exist, Share link elsewhere,
// Save file when the song is too long for a link.
import type { ShareView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

export interface ShareSheetModel {
  /** The link field, its length and the link actions. */
  readonly isLinkShown: boolean;
  readonly url: string;
  readonly lengthText: string;
  /** Why there is no link, in place of the field. */
  readonly noteText: string;
  readonly isLastValidShown: boolean;
  readonly isShareLinkShown: boolean;
  readonly copyLinkText: string;
  readonly isShareFileShown: boolean;
  /** The primary of the link actions. */
  readonly linkPrimary: "share-link" | "copy-link";
  /** Without a link, Save file is the way to carry the song. */
  readonly isSaveFilePrimary: boolean;
}

export function shareSheetModel(share: ShareView, isDesktop: boolean): ShareSheetModel {
  const { link } = share;
  const hasLink = link.kind === "ready";
  const copyIsPrimary = isDesktop || !share.canShareLink;
  return {
    isLinkShown: hasLink,
    url: hasLink ? link.url : "",
    lengthText: hasLink ? strings.linkLength(link.length) : "",
    noteText: link.kind === "too-long" ? strings.tooLongForLink : link.kind === "unavailable" ? strings.linkUnavailable : strings.linkPending,
    isLastValidShown: share.isLastValid,
    isShareLinkShown: share.canShareLink,
    copyLinkText: share.isCopied ? strings.linkCopied : strings.copyLink,
    isShareFileShown: share.canShareFile,
    linkPrimary: copyIsPrimary ? "copy-link" : "share-link",
    isSaveFilePrimary: !hasLink,
  };
}
