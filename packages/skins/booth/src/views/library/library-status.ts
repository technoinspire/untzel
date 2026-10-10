// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setText } from "../dom";
import { STATUS_ATTRIBUTES } from "../../behavior/library/library-grid";
import { auditionAnnouncement } from "../../behavior/library/library-labels";
import type { AuditionView } from "@untzel/presentation/view-model";

export interface LibraryStatus {
  readonly root: HTMLElement;
  update(audition: AuditionView | null): void;
}

/** The visually hidden region that says when an audition starts, switches and ends. */
export function createLibraryStatus(): LibraryStatus {
  const root = element("p", { className: "ui-visually-hidden", attributes: STATUS_ATTRIBUTES });
  let heard: AuditionView | null = null;
  return {
    root,
    update(audition) {
      const announcement = auditionAnnouncement(heard, audition);
      heard = audition;
      if (announcement !== null) setText(root, announcement);
    },
  };
}
