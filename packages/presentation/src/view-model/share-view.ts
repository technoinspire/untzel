// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The Share sheet: the link and what this device can do with it.

export type ShareLinkView =
  | { readonly kind: "pending" }
  | { readonly kind: "ready"; readonly url: string; readonly length: number }
  | { readonly kind: "too-long"; readonly length: number }
  | { readonly kind: "unavailable" };

export interface ShareView {
  readonly link: ShareLinkView;
  /** The text is invalid: the link carries the last version that plays. */
  readonly isLastValid: boolean;
  /** navigator.share exists. */
  readonly canShareLink: boolean;
  /** navigator.canShare accepts a file. */
  readonly canShareFile: boolean;
  /** Copy link confirmed: the label reads "Link copied". */
  readonly isCopied: boolean;
  /** The clipboard refused: the sheet selects the link for a manual copy. */
  readonly isCopyRefused: boolean;
}
