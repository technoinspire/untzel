// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ParameterView } from "@untzel/presentation/view-model";
import { createSliderRow, type SliderRow } from "./slider-row";

/** The rows are rebuilt only when this changes: the parameter names, in order. */
export function rowsKey(parameters: readonly ParameterView[]): string {
  return parameters.map((p) => p.name).join(",");
}

/** One slider row per parameter in `container`; existing rows are updated in place. */
export function syncRows(
  container: HTMLElement,
  rows: Map<string, SliderRow>,
  parameters: readonly ParameterView[],
  id: string,
  onInput: (parameter: string, fraction: number) => void,
  onEnd: () => void,
): void {
  const key = rowsKey(parameters);
  if (container.dataset["key"] !== key) {
    container.dataset["key"] = key;
    rows.clear();
    container.replaceChildren(...parameters.map((parameter) => {
      const row = createSliderRow(id, parameter.name, (fraction) => onInput(parameter.name, fraction), onEnd);
      rows.set(parameter.name, row);
      return row.root;
    }));
  }
  for (const parameter of parameters) rows.get(parameter.name)?.update(parameter);
}
