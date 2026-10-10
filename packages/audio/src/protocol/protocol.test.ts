// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { describe, expect, it } from "vitest";
import * as protocol from "./index";

describe("audio protocol constants", () => {
  it("fixes the version and the batch layout", () => {
    expect(protocol.PROTOCOL_VERSION).toBe(2);
    expect(protocol.BATCH_HEADER_LENGTH).toBe(2);
    expect(protocol.BATCH_EVENT_STRIDE).toBe(6);
    expect(protocol.BATCH_POINT_STRIDE).toBe(6);
    expect(protocol.HIT_NOTE).toBe(-1);
  });
});
