// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setText } from "../dom";
import { cpuLabel, isNearLimit } from "../../behavior/text/format";
import { strings, text } from "../../copy/copy";

export interface LibraryFooter {
  readonly root: HTMLElement;
  /** The device's load, 0..1, or null before the first measure. */
  update(cpu: number | null): void;
}

/** The CPU line of the library, with the warning when the device is near its limit. */
export function createLibraryFooter(): LibraryFooter {
  const warning = element("p", { className: "ui-library__warning", text: text.nearLimit, attributes: { hidden: true } });
  const cpu = element("p", { className: "ui-library__cpu" });
  return {
    root: element("div", { className: "ui-library__footer" }, [warning, cpu]),
    update(load) {
      setText(cpu, cpuLabel(load, strings.ofThisDevice));
      warning.hidden = !isNearLimit(load);
    },
  };
}
