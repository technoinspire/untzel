// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element } from "../dom";
import type { SessionIntents } from "@untzel/skin-contract";
import type { AppPhase, UntzelView } from "@untzel/presentation/view-model";
import type { ProjectIntents } from "@untzel/skin-contract";
import { strings, text } from "../../copy/copy";
import { ATTRIBUTION } from "../frame/attribution";
import { createIdleCenter } from "./idle-center";
import { createIdleTemplates } from "./idle-templates";

export interface IdleScreen {
  readonly root: HTMLElement;
  update(view: UntzelView): void;
}

/**
 * A load that fails hides Tap to play with the focus on it: Retry takes it.
 * Only on the change into the failure, and only when the focus has nowhere else to be.
 */
export function shouldFocusRetry(previousPhase: string, phase: AppPhase, isFocusLost: boolean): boolean {
  return phase === "load-failed" && previousPhase !== "load-failed" && isFocusLost;
}

/**
 * The waiting screen, plus the load-error and unsupported-browser states, and what arrived from a
 * link or a file: "Remix this", or why it could not be opened. Opening a file and the
 * language are in the menu; dropping a file on the stage still opens it.
 */
// Over 40 lines: one screen built and drawn; the focus and the announcements follow the phase.
export function createIdleScreen(
  intents: SessionIntents & Pick<ProjectIntents, "continueProject">,
  announce: (message: string) => void,
): IdleScreen {
  let selected = "";
  const start = (): void => intents.start(selected);

  const center = createIdleCenter(start, () => intents.retry());

  // Tapping anywhere on the waiting stage starts; the button is the
  // keyboard and screen reader path to the same intent.
  const hit = element("div", { className: "ui-idle__hit", attributes: { "aria-hidden": "true" } });
  hit.addEventListener("click", start);

  const templates = createIdleTemplates(intents);
  // The legal notice, shown every time Untzel is launched. The language is in the menu.
  const legal = element("div", { className: "ui-idle__legal" }, [
    element("p", { className: "ui-idle__legal-text", text: () => `${ATTRIBUTION.copyright} · ${strings.license}` }),
  ]);
  const root = element("section", { className: "ui-idle", attributes: { "aria-label": text.tapToPlay } }, [
    hit,
    center.root,
    templates.root,
    legal,
  ]);
  let lastPhase = "";

  return {
    root,
    update(view) {
      selected = view.templates.selected;
      root.dataset["phase"] = view.phase;
      const isFailed = view.phase === "load-failed";
      const isUnsupported = view.phase === "unsupported";
      center.setPhase(isFailed, isUnsupported);
      templates.root.hidden = isUnsupported;
      hit.hidden = isFailed || isUnsupported;
      templates.setResume(view.project);
      center.showNotice(view.templates.notice, isFailed || isUnsupported);
      if (shouldFocusRetry(lastPhase, view.phase, isFocusLostIn(root))) center.retry.focus({ preventScroll: true });
      if (view.phase !== lastPhase) {
        lastPhase = view.phase;
        if (isFailed) announce(strings.loadFailed);
        if (isUnsupported) announce(strings.unsupported);
      }
      templates.update(view.templates);
      center.setPlay(view.templates.catalog.blank !== null && view.templates.selected === view.templates.catalog.blank.id);
    },
  };

}

/** On the body, or on a control of this screen that just hid (Tap to play). */
function isFocusLostIn(screen: HTMLElement): boolean {
  const active = document.activeElement;
  return active === null || active === document.body || (screen.contains(active) && active instanceof HTMLElement && !active.checkVisibility());
}
