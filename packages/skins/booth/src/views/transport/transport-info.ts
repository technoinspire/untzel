// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setText } from "../dom";
import type { PlayRangeView, TransportView } from "@untzel/presentation/view-model";
import { transportLines } from "../range/range-label";

export interface TransportInfo {
  readonly root: HTMLElement;
  update(transport: TransportView, playRange: PlayRangeView): void;
  /** The CPU line shown under the position below 1200 px. */
  setCpu(label: string): void;
}

/** The transport's text lines: the mobile, narrow and full lines, the position and the mobile CPU. */
export function createTransportInfo(tempoKey: HTMLElement): TransportInfo {
  // The first line under 1200 px drops words to fit; its accessible name is the whole text.
  const mobileShort = element("span", { attributes: { "aria-hidden": "true" } });
  const mobileFull = element("span", { className: "ui-visually-hidden" });
  // A narrow desktop column (1200–1280 px with a panel open) shows fewer words still.
  const narrowShort = element("span", { className: "ui-transport__line-narrow", attributes: { "aria-hidden": "true" } });
  const mobileLine = element("span", { className: "ui-transport__line ui-transport__line--mobile" }, [mobileShort, narrowShort, mobileFull]);
  // "124 BPM · c minor": the second line under 1200 px, the first one above.
  const desktopLine = element("span", { className: "ui-transport__line ui-transport__line--tempo" }, [tempoKey]);
  const position = element("span", { className: "ui-transport__position" });
  const cpuMobile = element("span", { className: "ui-transport__sub ui-transport__sub--mobile" });
  return {
    root: element("p", { className: "ui-transport__info" }, [mobileLine, desktopLine, position, cpuMobile]),
    update(transport, playRange) {
      const lines = transportLines(transport, playRange);
      setText(mobileShort, lines.short);
      setText(narrowShort, lines.narrow);
      setText(mobileFull, lines.full);
      // The desktop's position line: "Loop · bars 3–6 of 8 · bar 4".
      setText(position, lines.full);
    },
    setCpu: (label) => setText(cpuMobile, label),
  };
}
