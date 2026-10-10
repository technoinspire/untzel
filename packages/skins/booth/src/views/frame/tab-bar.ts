// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element } from "../dom";
import { icon } from "../icons";
import type { MobileTab } from "../../shell/navigation";
import { text, type Label } from "../../copy/copy";

// The phone's bottom navigation: Tracks and Song. The code opens only from Code next to
// Drop.

export const TABS: readonly MobileTab[] = ["tracks", "song"];
export const TAB_LABELS: Readonly<Record<MobileTab, Label>> = { tracks: text.tracks, song: text.song };

export interface TabBar {
  readonly root: HTMLElement;
  update(current: MobileTab): void;
}

export function createTabBar(id: string, onTab: (tab: MobileTab) => void): TabBar {
  const tabs = TABS.map((tab) => {
    const node = button("ui-tabs__tab", TAB_LABELS[tab], () => onTab(tab), [
      icon(tab),
      element("span", { text: TAB_LABELS[tab] }),
    ]);
    node.removeAttribute("aria-label");
    node.dataset["tab"] = tab;
    return node;
  });
  const root = element("nav", { className: "ui-tabs", attributes: { id, "aria-label": text.navigation } }, tabs);
  return {
    root,
    update(current) {
      for (const tab of tabs) {
        if (tab.dataset["tab"] === current) tab.setAttribute("aria-current", "page");
        else tab.removeAttribute("aria-current");
      }
    },
  };
}
