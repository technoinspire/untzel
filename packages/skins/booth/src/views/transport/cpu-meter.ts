// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, setVar, setText } from "../dom";
import { cpuLabel, isNearLimit } from "../../behavior/text/format";
import type { Label } from "../../copy/copy";

/** The meter's fill (0 to 1) and its spoken percentage for a load fraction. */
export function meterValue(fraction: number): { readonly fill: number; readonly percent: number } {
  const fill = Math.min(1, Math.max(0, fraction));
  return { fill, percent: Math.round(fill * 100) };
}

export function meter(className: string, label: Label): HTMLElement {
  return element("span", {
    className: `ui-meter ${className}`,
    attributes: { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100 },
  }, [element("span", { className: "ui-meter__fill" })]);
}

export function updateMeter(node: HTMLElement, fraction: number): void {
  const value = meterValue(fraction);
  setVar(node, "--fill", value.fill);
  node.setAttribute("aria-valuenow", String(value.percent));
}

/** The transport's CPU text and meter, marked near the limit. */
export function createCpuMeter(): { readonly root: HTMLElement; update(cpu: number | null): void } {
  const cpuText = element("span", { className: "ui-transport__cpu-text" });
  const cpuMeter = meter("ui-transport__cpu-meter", "CPU");
  const root = element("p", { className: "ui-transport__cpu" }, [cpuText, cpuMeter]);
  return {
    root,
    update(cpu) {
      setText(cpuText, cpuLabel(cpu));
      updateMeter(cpuMeter, cpu ?? 0);
      root.classList.toggle("is-near-limit", isNearLimit(cpu));
    },
  };
}
