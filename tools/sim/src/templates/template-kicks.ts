// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The kick of every template, played alone
// with the sound parameters its line writes, differs from every other template's kick by
// the kick rule (`kickViolation`: MFCC or decay).
import { extractFeatures, mfccDistance } from "../timbre/timbre";
import { kickViolation } from "../timbre/timbre-rules";
import { renderMono } from "../timbre/timbre-matrix";
import { SAMPLE_RATE } from "../render/run";
import type { TemplateKit } from "./template-kit";

/** The timbre gate's drum protocol: one hit in three bars at tempo 120, 6 s. */
const KICK_SECONDS = 6;

export interface KickDistance {
  readonly a: string;
  readonly b: string;
  readonly distance: number;
  readonly passes: boolean;
}

/** The source that plays `line` (`kick <preset> | <parameters>`) once, alone. */
export function kickSource(line: string): string {
  const [sound = "", ...parameters] = line.split(" | ");
  const modifiers = parameters.map((parameter) => ` | ${parameter}`).join("");
  return `tempo 120\nkey c minor\nvoice: ${sound} x... / .... / ....${modifiers}\n`;
}

export function kickDistances(kits: readonly TemplateKit[], wasm: WebAssembly.Module): KickDistance[] {
  const withKick = kits.flatMap((kit) => (kit.kick === null ? [] : [{ template: kit.template, features: extractFeatures(renderMono(kickSource(kit.kick), KICK_SECONDS, wasm), { sampleRate: SAMPLE_RATE }) }]));
  const distances: KickDistance[] = [];
  for (let i = 0; i < withKick.length; i += 1) {
    for (let j = i + 1; j < withKick.length; j += 1) {
      const [a, b] = [withKick[i]!, withKick[j]!];
      const distance = mfccDistance(a.features.mfcc, b.features.mfcc);
      distances.push({ a: a.template, b: b.template, distance, passes: kickViolation(a.features, b.features) === null });
    }
  }
  return distances.sort((x, y) => x.distance - y.distance);
}
