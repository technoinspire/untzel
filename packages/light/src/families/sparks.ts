// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { curlAdvect } from "../composer/flow-noise";
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import { FLOW_PER_BEAT, area, drawsOf, fade, figure, type Pulse } from "./family-context";
// sparks: the sky's small events. needle (hat) draws vertical strokes with a white core,
// longer when open; orbit (ride) dots on an ellipse inside its cell; grain (shaker) dust
// carried by a curl-noise flow, a pure function of birth and age that never leaves its cell.

const SALT = 0x5a;
const CURL_SPEED = 0.02;
const CURL_FREQUENCY = 3;
const DRIFT_PER_SECOND = 0.12;
/**
 * The sky's haze, its reach ending 0.02 u under the top chrome line (−0.78 u). The band's
 * bell is 0 at its reach, so the haze fades out on its own and the chrome mask never cuts
 * it: centred at −0.6 with a reach of 0.2 it crossed the line and showed a hard top edge.
 */
const SKY_HAZE_Y = -0.56;
const SKY_HAZE_HALF_HEIGHT = 0.2;

export function sparksLife(shape: string, tone: number): number {
  return { needle: 0.16 + tone * 0.4, orbit: 0.7, grain: 0.35 }[shape] ?? 0.3;
}

export function sparksPrimitives(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue } = pulse;
  // The sky lights a little behind its sparks, edge to edge: a haze, not dots on black.
  const sky = area(pulse, AreaKind.Band, { x: 0, y: SKY_HAZE_Y, size: SKY_HAZE_HALF_HEIGHT, intensity: cue.velocity * 0.3 * fade(pulse, 1) });
  switch (pulse.description.shape) {
    case "orbit":
      return [...orbit(pulse), sky];
    case "grain":
      return [...grain(pulse), sky];
    default:
      return [...needles(pulse), sky];
  }
}

function needles(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const random = drawsOf(pulse, SALT);
  const length = Math.min(anchor.reachY * 1.6, (0.07 + pulse.tone * 0.08) * pulse.scale);
  const count = 2 + 2 * description.density;
  return Array.from({ length: count }, () =>
    figure(pulse, FigureKind.Needle, {
      x: anchor.x + (random() - 0.5) * 2 * anchor.reachX * 0.9,
      y: anchor.y + (random() - 0.5) * 2 * Math.max(0, anchor.reachY - length / 2),
      size: length,
      width: 0.007,
      intensity: Math.min(1, cue.velocity * 1.25) * fade(pulse, 2),
    }),
  );
}

function orbit(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const random = drawsOf(pulse, SALT);
  return Array.from({ length: 3 + description.density }, (_, index) => {
    const angle = description.phase * Math.PI * 2 + pulse.beat * 0.25 + index * 0.42 + cue.tick * 0.05;
    return figure(pulse, FigureKind.Dot, {
      x: anchor.x + Math.cos(angle) * anchor.reachX * 0.8,
      y: anchor.y + Math.sin(angle) * anchor.reachY * 0.6,
      size: 0.014,
      intensity: cue.velocity * fade(pulse, 2) * (0.6 + 0.4 * random()),
    });
  });
}

function grain(pulse: Pulse): readonly ScenePrimitive[] {
  const { anchor, cue, description } = pulse;
  const random = drawsOf(pulse, SALT);
  const spreadX = anchor.reachX * 0.9;
  const spreadY = anchor.reachY * 0.8;
  const birthFlow = pulse.isReduced ? 0 : pulse.flow - pulse.age * FLOW_PER_BEAT;
  return Array.from({ length: 3 * description.density }, () => {
    const startX = (random() - 0.5) * 2 * spreadX;
    const startY = (random() - 0.5) * 2 * spreadY;
    const [movedX, movedY] = pulse.isReduced
      ? [anchor.x + startX, anchor.y + startY]
      : curlAdvect(anchor.x + startX, anchor.y + startY, pulse.age, birthFlow, CURL_SPEED, description.lookSeed, CURL_FREQUENCY);
    const drift = pulse.isReduced ? 0 : pulse.age * DRIFT_PER_SECOND * description.mirror;
    const offset = movedX - anchor.x + drift;
    const wrapped = ((((offset + spreadX) % (2 * spreadX)) + 2 * spreadX) % (2 * spreadX)) - spreadX;
    const y = Math.min(spreadY, Math.max(-spreadY, movedY - anchor.y));
    return figure(pulse, FigureKind.Dot, { x: anchor.x + wrapped, y: anchor.y + y, size: 0.009, intensity: cue.velocity * 0.85 * fade(pulse, 2) });
  });
}
