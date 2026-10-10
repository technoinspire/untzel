// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setPressed } from "../dom";
import { icon } from "../icons";
import type { Panel } from "../../shell/navigation";
import { text, type Label } from "../../copy/copy";

// The desktop side panel (480 px): its tabs, its ×, and the sheets it holds. On the phone
// it is display: contents and its sheets are bottom sheets. The Part tab
// shows in song mode only: the arrangement is not part of loop mode. A tab of its own,
// rather than replacing Track, keeps both editors one tap away. The
// code is no tab: it lies over Track or Part with its own heading
// and ×, opened by Code next to Drop. With the code no tab, loop mode leaves Track alone:
// a group of one switches nothing, so the strip hides until Part joins it.

export const PANEL_TABS: readonly Panel[] = ["track", "part"];
const TAB_LABELS: Readonly<Record<Panel, Label>> = { track: text.track, part: text.part };

/** The tabs the strip offers: Part in song mode only. */
export function visiblePanelTabs(hasPartTab: boolean): readonly Panel[] {
  return PANEL_TABS.filter((panel) => panel !== "part" || hasPartTab);
}

/** A strip of one tab switches nothing. */
export function isTabStripShown(hasPartTab: boolean): boolean {
  return visiblePanelTabs(hasPartTab).length > 1;
}

export interface SidePanelOptions {
  readonly onTab: (panel: Panel) => void;
  readonly onClose: () => void;
  /** The Code panel's width divider, on the panel's edge. */
  readonly divider: HTMLElement;
  readonly sheets: readonly HTMLElement[];
}

export interface SidePanel {
  readonly root: HTMLElement;
  update(panel: Panel | null, hasPartTab: boolean): void;
}

export function createSidePanel(options: SidePanelOptions): SidePanel {
  const tabs = PANEL_TABS.map((panel) => {
    const node = button("ui-segmented__option", TAB_LABELS[panel], () => options.onTab(panel));
    node.dataset["panel"] = panel;
    return node;
  });
  const strip = element("div", { className: "ui-segmented ui-panel__tabs", attributes: { role: "group", "aria-label": text.sidePanel } }, tabs);
  const close = button("ui-round ui-round--raised ui-panel__close", text.close, options.onClose, [icon("close")]);
  const root = element("aside", { className: "ui-panel", attributes: { "aria-label": text.sidePanel } }, [
    options.divider,
    element("div", { className: "ui-panel__bar" }, [
      strip,
      close,
    ]),
    ...options.sheets,
  ]);
  return {
    root,
    update(panel, hasPartTab) {
      const shown = visiblePanelTabs(hasPartTab);
      tabs.forEach((tab) => {
        setPressed(tab, tab.dataset["panel"] === panel);
        tab.hidden = !shown.includes(tab.dataset["panel"] as Panel);
      });
      strip.hidden = !isTabStripShown(hasPartTab);
    },
  };
}
