// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// How a scene sits on a stage of any size: the composition
// square, whose unit u is half the safe area's shorter
// side, is placed on the stage by one uniform map. Every anchor and reach is a number in u,
// so the desktop stage, the phone, the 16:9 video and the 9:16 story show the same
// composition; only the room past the square changes. Pure.

export interface StageSize {
  /** Any unit (CSS pixels, device pixels, video pixels): only the ratio matters. */
  readonly width: number;
  readonly height: number;
}

/**
 * Renderers draw in units of the stage height, origin at the centre, y down. A fit says
 * how scene units map into those units for this stage.
 */
export interface SceneFit {
  /** width / height. */
  readonly aspect: number;
  /** Height units per scene unit. */
  readonly scale: number;
  /** The shorter side in height units (1 in landscape, the aspect in portrait). */
  readonly shortSide: number;
  /** Half the safe area, in height units. */
  readonly safeHalfWidth: number;
  readonly safeHalfHeight: number;
}

/** The composition square on one stage. */
export interface SceneSquare {
  /** Stage-height units per u. */
  readonly unit: number;
  /** How far the safe area runs past the square, in u: 1 on the shorter axis. */
  readonly hx: number;
  readonly hy: number;
}

/** Margin on every edge, as a fraction of the shorter side. */
export const SAFE_MARGIN = 0.08;
/** The scene radius that fits half the safe area's shorter side. */
export const DESIGN_RADIUS = 0.75;

export function fitScene(size: StageSize): SceneFit {
  const width = Math.max(1, size.width);
  const height = Math.max(1, size.height);
  const aspect = width / height;
  const shortSide = Math.min(width, height) / height;
  const margin = SAFE_MARGIN * shortSide;
  const safeHalfShort = shortSide / 2 - margin;
  return {
    aspect,
    scale: safeHalfShort / DESIGN_RADIUS,
    shortSide,
    safeHalfWidth: aspect / 2 - margin,
    safeHalfHeight: 0.5 - margin,
  };
}

/** u = half the safe area's shorter side, in stage-height units. */
export function sceneSquare(fit: SceneFit): SceneSquare {
  const unit = fit.scale * DESIGN_RADIUS;
  return { unit, hx: fit.safeHalfWidth / unit, hy: fit.safeHalfHeight / unit };
}

/** Lengths a primitive carries; every one of them is in u and maps by the same unit. */
export interface Placeable {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly width: number;
}

/** One uniform map from u to stage-height units, the same for every kind. */
export function placeOnStage<T extends Placeable>(primitive: T, square: SceneSquare): T {
  const { unit } = square;
  return { ...primitive, x: primitive.x * unit, y: primitive.y * unit, size: primitive.size * unit, width: primitive.width * unit };
}

/** A point of the stage (pixels, origin top left) in u. */
export function stageToSquare(px: number, py: number, size: StageSize): { readonly x: number; readonly y: number } {
  const { unit } = sceneSquare(fitScene(size));
  const height = Math.max(1, size.height);
  return { x: (px - size.width / 2) / height / unit, y: (py - height / 2) / height / unit };
}
