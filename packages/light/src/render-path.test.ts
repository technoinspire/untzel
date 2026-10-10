// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The same text gives the same frames on the screen and in the video. Nothing on
// the render path draws a random number, and the light's pure modules read no clock: time
// comes in as audio time.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../../", import.meta.url).pathname;

function sources(path: string): string[] {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return [full];
  return readdirSync(full).flatMap((entry) => (entry.endsWith(".test.ts") ? [] : sources(join(path, entry)).filter((file) => file.endsWith(".ts"))));
}

const NO_RANDOM = ["packages/scene/src", "packages/light/src", "packages/export/src"];
const NO_CLOCK = [
  "packages/scene/src",
  "packages/core/src/pattern/modulator-position.ts",
  "packages/light/src/families",
  "packages/light/src/composer/composer.ts",
  "packages/light/src/composer/scene-budget.ts",
  "packages/light/src/composer/zone-exposure.ts",
  "packages/light/src/safety/limiter-clock.ts",
  "packages/light/src/composer/feedback-schedule.ts",
  "packages/light/src/composer/flow-noise.ts",
  "packages/light/src/safety/post-light.ts",
  "packages/light/src/cues/tone-motion.ts",
  "packages/light/src/stage/frame-driver.ts",
  "packages/light/src/cues/program-timeline.ts",
  "packages/light/src/stage/musical-clock.ts",
  "packages/light/src/cues/cue-mapper.ts",
];

function offenders(paths: readonly string[], pattern: RegExp): string[] {
  return paths.flatMap(sources).filter((file) => pattern.test(readFileSync(file, "utf8"))).map((file) => relative(ROOT, file));
}

describe("the render path", () => {
  it("never calls Math.random", () => {
    expect(offenders(NO_RANDOM, /Math\.random/)).toEqual([]);
  });

  it("reads no clock in the light's pure modules", () => {
    expect(offenders(NO_CLOCK, /performance\.now|Date\.now|requestAnimationFrame/)).toEqual([]);
  });
});
