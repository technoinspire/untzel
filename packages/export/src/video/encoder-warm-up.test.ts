// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The warm-up against a fake WebCodecs: it asks for the quantizer configuration, encodes
// one frame with the governor's starting quantizer, and never throws.
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUANTIZER_SCALES } from "./bitrate-governor";
import { warmUpVideoEncoder } from "./encoder-warm-up";

const FRAME = { width: 1920, height: 1080 };

function fakeWebCodecs(options: { readonly supported: boolean; readonly flush: () => Promise<void> }) {
  const seen = { configs: [] as VideoEncoderConfig[], encodes: [] as VideoEncoderEncodeOptions[], closed: 0 };
  class FakeEncoder {
    state = "unconfigured";
    static async isConfigSupported(config: VideoEncoderConfig) {
      seen.configs.push(config);
      return { supported: options.supported };
    }
    configure() {
      this.state = "configured";
    }
    encode(_frame: unknown, encodeOptions: VideoEncoderEncodeOptions) {
      seen.encodes.push(encodeOptions);
    }
    flush() {
      return options.flush();
    }
    close() {
      this.state = "closed";
      seen.closed += 1;
    }
  }
  class FakeFrame {
    close() {}
  }
  vi.stubGlobal("VideoEncoder", FakeEncoder);
  vi.stubGlobal("VideoFrame", FakeFrame);
  return seen;
}

afterEach(() => vi.unstubAllGlobals());

describe("warmUpVideoEncoder", () => {
  it("is false without WebCodecs", async () => {
    vi.stubGlobal("VideoEncoder", undefined);
    expect(await warmUpVideoEncoder(FRAME)).toBe(false);
  });

  it("starts the H.264 quantizer encoder on one frame and closes it", async () => {
    const seen = fakeWebCodecs({ supported: true, flush: async () => undefined });
    expect(await warmUpVideoEncoder(FRAME)).toBe(true);
    expect(seen.configs[0]).toMatchObject({ codec: "avc1.640028", bitrateMode: "quantizer", hardwareAcceleration: "prefer-hardware", width: 1920, height: 1080 });
    expect(seen.encodes).toEqual([{ keyFrame: true, avc: { quantizer: QUANTIZER_SCALES.avc.start } }]);
    expect(seen.closed).toBe(1);
  });

  it("is false, and encodes nothing, where the quantizer is refused", async () => {
    const seen = fakeWebCodecs({ supported: false, flush: async () => undefined });
    expect(await warmUpVideoEncoder(FRAME)).toBe(false);
    expect(seen.encodes).toEqual([]);
  });

  it("gives up at the deadline on a flush that never comes", async () => {
    const seen = fakeWebCodecs({ supported: true, flush: () => new Promise(() => undefined) });
    expect(await warmUpVideoEncoder(FRAME, 5)).toBe(false);
    expect(seen.closed).toBe(1);
  });
});
