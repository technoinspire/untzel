// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setText } from "../dom";
import { icon } from "../icons";
import type { ReceivedNotice } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { receivedNoticeModel } from "./received-notice";
import { idlePlayLabels } from "./template-picker-model";

export interface IdleCenter {
  readonly root: HTMLElement;
  readonly retry: HTMLButtonElement;
  /** Tap to play gives way to the failure and Retry, or to the unsupported browser. */
  setPhase(isFailed: boolean, isUnsupported: boolean): void;
  /** "Remix this", or why a link or a file could not be opened. */
  showNotice(received: ReceivedNotice | null, isBlocked: boolean): void;
  /** Tap to play, or Start blank when the blank template is chosen. */
  setPlay(isBlank: boolean): void;
}

/** The middle of the waiting screen: the received notice, Tap to play, the failure and Retry. */
// Over 40 lines: one block built and drawn, in the waiting screen's order.
export function createIdleCenter(start: () => void, retry: () => void): IdleCenter {
  const playLabel = element("span", { className: "ui-idle__label", text: strings.tapToPlay });
  const play = element("button", { className: "ui-idle__play", attributes: { type: "button", "aria-describedby": "ui-idle-sub" } }, [
    element("span", { className: "ui-idle__ring", attributes: { "aria-hidden": "true" } }, [icon("play"), icon("plus")]),
    playLabel,
  ]);
  play.addEventListener("click", start);
  const sub = element("p", { className: "ui-idle__sub", text: strings.startsOnNextBar, attributes: { id: "ui-idle-sub" } });

  const retryButton = button("ui-idle__retry ui-pill ui-pill--primary", text.retry, retry);
  const failure = element("p", { className: "ui-idle__failure", text: text.loadFailed });
  const unsupported = element("p", { className: "ui-idle__unsupported", text: text.unsupported });

  // A paragraph with a class, not a heading: the only h1 stays "Untzel".
  const remixTitle = element("p", { className: "ui-idle__remix-title", text: text.remixThis });
  const remixText = element("p", { className: "ui-idle__remix-text" });
  const remix = element("div", { className: "ui-idle__remix" }, [remixTitle, remixText]);
  const notice = element("p", { className: "ui-idle__notice" });
  return {
    root: element("div", { className: "ui-idle__center" }, [remix, notice, play, sub, failure, retryButton, unsupported]),
    retry: retryButton,
    setPhase(isFailed, isUnsupported) {
      play.hidden = isFailed || isUnsupported;
      sub.hidden = isFailed || isUnsupported;
      failure.hidden = !isFailed;
      retryButton.hidden = !isFailed;
      unsupported.hidden = !isUnsupported;
    },
    showNotice(received, isBlocked) {
      const model = receivedNoticeModel(received, isBlocked);
      remix.hidden = !model.isRemixShown;
      notice.hidden = !model.isFailureShown;
      if (model.isRemixShown) setText(remixText, model.remixText);
      if (model.isFailureShown) setText(notice, model.failureText);
    },
    setPlay(isBlank) {
      const labels = idlePlayLabels(isBlank);
      setText(playLabel, labels.label);
      setText(sub, labels.hint);
      play.dataset["blank"] = String(labels.label !== strings.tapToPlay);
    },
  };
}
