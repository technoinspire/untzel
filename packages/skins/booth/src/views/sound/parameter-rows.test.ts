// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ParameterView } from "@untzel/presentation/view-model";
import { rowsKey } from "./parameter-rows";
const parameter = (name: string): ParameterView => ({ name }) as ParameterView;
describe("rowsKey", () => {
  it("names the parameters in order, so a new value keeps the rows", () => {
    expect(rowsKey([parameter("cutoff"), parameter("res")])).toBe("cutoff,res");
  });
  it("changes when the parameters change, so the rows are rebuilt", () => {
    expect(rowsKey([parameter("res"), parameter("cutoff")])).not.toBe(rowsKey([parameter("cutoff"), parameter("res")]));
    expect(rowsKey([])).toBe("");
  });
});
