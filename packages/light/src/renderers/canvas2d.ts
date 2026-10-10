// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { encodeSrgb } from "@untzel/scene/palette";
import { FIGURE_GAIN } from "../safety/post-light";
import { SKY_OVERLAP_U, featherRings, zoneEllipse } from "./mask-shape";
import { AreaKind, FigureKind, type ScenePrimitive } from "../composer/scene-primitive";
import type { DrawnFrame, StageCanvas, StageContext2D, StageRenderer } from "./renderer";
// The fallback level when WebGL2 is missing: the same primitives as plain canvas
// shapes and gradients, with no trail and no bloom. The music never depends on it.

export function createCanvas2DRenderer(canvas: StageCanvas): StageRenderer | null {
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) return null;
  return {
    kind: "2d",
    resize(width, height) {
      canvas.width = width;
      canvas.height = height;
    },
    stepTrail() {
      // No trail at this level.
    },
    clearTrail() {
      // No trail at this level.
    },
    present(frame, _warp, post) {
      const { width, height } = canvas;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = "source-over";
      context.globalAlpha = 1;
      context.fillStyle = "#0B0B0C";
      context.fillRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      // Stage-height units, origin at the centre.
      context.setTransform(height, 0, 0, height, width / 2, height / 2);
      for (const primitive of frame.primitives) draw(context, primitive, frame, width / height / 2, post.outputGain);
      maskOut(context, frame, width / height / 2);
      // After the mask, as in WebGL2: no scene light crosses the line, only the file's sky.
      context.globalCompositeOperation = "lighter";
      drawAtmosphere(context, frame, width / height / 2, post.outputGain);
    },
    destroy() {
      // Nothing to release.
    },
  };
}

function colorOf(frame: DrawnFrame, slot: number, alpha: number): string {
  const channel = (offset: number): number => Math.round(encodeSrgb(frame.palette[slot * 3 + offset] ?? 1) * 255);
  return `rgb(${channel(0)} ${channel(1)} ${channel(2)} / ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
}

function draw(context: StageContext2D, primitive: ScenePrimitive, frame: DrawnFrame, halfWidth: number, gain: number): void {
  if (primitive.layer === "area") return drawArea(context, primitive, frame, halfWidth, Math.min(1, primitive.intensity * gain));
  const alpha = Math.min(1, primitive.intensity * gain * FIGURE_GAIN);
  context.strokeStyle = colorOf(frame, primitive.color, alpha);
  context.fillStyle = context.strokeStyle;
  context.lineWidth = Math.max(primitive.width, 0.002);
  const { x, y, size } = primitive;
  context.beginPath();
  switch (primitive.kind) {
    case FigureKind.Ring:
      context.arc(x, y, size, primitive.extra === 1 ? Math.PI : 0, Math.PI * 2);
      break;
    case FigureKind.Arcs:
      for (let part = 0; part < primitive.extra; part += 1) {
        const start = primitive.rotation + (part * Math.PI * 2) / primitive.extra;
        context.moveTo(x + Math.cos(start) * size, y + Math.sin(start) * size);
        context.arc(x, y, size, start, start + (Math.PI * 2 * 0.6) / primitive.extra);
      }
      break;
    case FigureKind.Ellipse:
      context.ellipse(x, y, size, size * primitive.aspect, 0, 0, Math.PI * 2);
      break;
    case FigureKind.Line:
    case FigureKind.Comb:
      context.moveTo(-halfWidth, y);
      context.lineTo(halfWidth, y);
      break;
    case FigureKind.Dot:
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
      return;
    case FigureKind.Bar:
      context.fillRect(x - size, y - size * primitive.aspect, size * 2, size * primitive.aspect * 2);
      return;
    default:
      context.moveTo(x, y - size / 2);
      context.lineTo(x, y + size / 2);
  }
  context.stroke();
}

function drawArea(context: StageContext2D, primitive: ScenePrimitive, frame: DrawnFrame, halfWidth: number, alpha: number): void {
  const { x, y, size } = primitive;
  const solid = colorOf(frame, primitive.color, alpha);
  const clear = colorOf(frame, primitive.color, 0);
  if (primitive.kind === AreaKind.Band || primitive.kind === AreaKind.Rise) {
    const top = y - size;
    const bottom = primitive.kind === AreaKind.Band ? y + size : y + Math.max(primitive.aspect * frame.unit, 0.001);
    const gradient = context.createLinearGradient(0, top, 0, bottom);
    gradient.addColorStop(0, clear);
    gradient.addColorStop(primitive.kind === AreaKind.Band ? 0.5 : (y - top) / (bottom - top), solid);
    gradient.addColorStop(1, clear);
    context.fillStyle = gradient;
    context.fillRect(-halfWidth, top, halfWidth * 2, bottom - top);
    return;
  }
  const gradient = context.createRadialGradient(x, y, 0, x, y, size);
  gradient.addColorStop(0, solid);
  gradient.addColorStop(1, clear);
  context.fillStyle = gradient;
  context.fillRect(x - size, y - size, size * 2, size * 2);
}

/** A file's sky over the chrome line: the haze's mean level, from SKY_OVERLAP_U under it, without texture. */
function drawAtmosphere(context: StageContext2D, frame: DrawnFrame, halfWidth: number, gain: number): void {
  const sky = frame.atmosphere;
  if (sky === null || sky.lineY <= -0.5) return;
  const bottom = sky.lineY + SKY_OVERLAP_U * frame.unit;
  const gradient = context.createLinearGradient(0, sky.lineY, 0, bottom);
  gradient.addColorStop(0, colorOf(frame, sky.color, Math.min(1, sky.level * gain * 0.66)));
  gradient.addColorStop(1, colorOf(frame, sky.color, 0));
  context.fillStyle = gradient;
  context.fillRect(-halfWidth, -0.5, halfWidth * 2, bottom + 0.5);
}

/** Rings of the stage colour that give the 2D level the shader's soft ellipse (mask-shape.ts). */
const FEATHER_RINGS = 6;

function maskOut(context: StageContext2D, frame: DrawnFrame, halfWidth: number): void {
  context.globalCompositeOperation = "source-over";
  const { boxes, feather, topY } = frame.mask;
  const rings = [...featherRings(feather, FEATHER_RINGS), { offset: 0, alpha: 1 }];
  for (const box of boxes) {
    const ellipse = zoneEllipse(box);
    for (const ring of rings) {
      context.fillStyle = `rgb(11 11 12 / ${ring.alpha.toFixed(4)})`;
      context.beginPath();
      context.ellipse(ellipse.centerX, ellipse.centerY, ellipse.radiusX + ring.offset, ellipse.radiusY + ring.offset, 0, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.fillStyle = "#0B0B0C";
  if (topY !== null) context.fillRect(-halfWidth, -1, halfWidth * 2, 1 + topY);
}
