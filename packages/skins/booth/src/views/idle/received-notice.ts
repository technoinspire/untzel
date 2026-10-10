// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the waiting stage says about text that arrived from a link or a file: "Remix this" with
// where it came from, or why it could not be opened. Hidden behind a load error or an
// unsupported browser, which take the stage.
import type { ReceivedNotice } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";

export interface ReceivedNoticeModel {
  readonly isRemixShown: boolean;
  readonly remixText: string;
  readonly isFailureShown: boolean;
  readonly failureText: string;
}

export function receivedNoticeModel(received: ReceivedNotice | null, isBlocked: boolean): ReceivedNoticeModel {
  const isRemix = !isBlocked && received?.kind === "remix";
  const isFailure = !isBlocked && received?.kind === "failed";
  return {
    isRemixShown: isRemix,
    remixText: received?.kind === "remix" ? (received.from === "link" ? strings.remixFromLink : strings.remixFromFile) : "",
    isFailureShown: isFailure,
    failureText: received?.kind === "failed" ? received.message : "",
  };
}
