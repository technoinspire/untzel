// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { boxArea } from "./floor-wings";
import type { ExclusionBox } from "./keep-out";
// How a zone divides its space among its members: rows of
// cells, horizontal lanes, the core's concentric bands, the orbit's sectors and the floor's
// wings. Every member gets space of its own; with more members the space shrinks.

export interface Interval {
  readonly from: number;
  readonly to: number;
}

/** A member's place, before the plan's scale and rotation are added. */
export interface Slot {
  readonly x: number;
  readonly y: number;
  readonly reachX: number;
  readonly reachY: number;
  /** Lanes and edge-to-edge members run across the whole safe width. */
  readonly spansWidth: boolean;
  /** The core's radial band. */
  readonly band: Interval | null;
  /** A lane's vertical extent. */
  readonly lane: Interval | null;
}

export interface Row {
  readonly x: Interval;
  readonly y: Interval;
}

export const CORE_CENTRE_Y = -0.02;
export const CORE_OFFSET = 0.18;
export const CORE_INNER = 0.06;
export const CORE_MAX_RADIUS = 0.76;
const CELL_FILL = 0.92;
const PAN_SHARE = 0.25;
const ROW_PHASE_SHARE = 0.3;
const ORBIT = { radiusX: 0.8, radiusY: 0.56, spanDegrees: 64, maxReach: 0.12 } as const;

/** The anchor stays inside its cell: the phase and the pan move it, and the reach shrinks by as much. */
export function rowSlot(row: Row, slot: number, count: number, isMirrored: boolean, phase: number, pan: number): Slot {
  const cell = isMirrored ? count - 1 - slot : slot;
  const width = (row.x.to - row.x.from) / count;
  const halfCell = width / 2;
  const panShift = pan * PAN_SHARE * (1 - CELL_FILL) * halfCell;
  const halfHeight = (row.y.to - row.y.from) / 2;
  const shift = (phase - 0.5) * 2 * ROW_PHASE_SHARE * halfHeight;
  return {
    x: row.x.from + width * (cell + 0.5) + panShift,
    y: row.y.from + halfHeight + shift,
    reachX: halfCell * CELL_FILL - Math.abs(panShift),
    reachY: halfHeight - Math.abs(shift),
    spansWidth: false,
    band: null,
    lane: null,
  };
}

export function laneSlot(y: Interval, slot: number, count: number): Slot {
  const height = (y.to - y.from) / count;
  const middle = y.from + height * (slot + 0.5);
  return {
    x: 0,
    y: middle,
    reachX: 1,
    reachY: (height / 2) * CELL_FILL,
    spansWidth: true,
    band: null,
    lane: { from: middle - height / 2, to: middle + height / 2 },
  };
}

/** Upper arc of an ellipse centred on the core, semi-axes 0.8 × 0.56, ±64°. */
export function orbitSlot(slot: number, count: number, isMirrored: boolean, coreX: number): Slot {
  const side = isMirrored ? -1 : 1;
  const step = (2 * ORBIT.spanDegrees) / count;
  const angle = ((-90 + side * (-ORBIT.spanDegrees + step * (slot + 0.5))) * Math.PI) / 180;
  const chord = 2 * ORBIT.radiusX * Math.sin(((step / 2) * Math.PI) / 180);
  const reach = Math.min(ORBIT.maxReach, chord * 0.46);
  return {
    x: coreX + Math.cos(angle) * ORBIT.radiusX,
    y: CORE_CENTRE_Y + Math.sin(angle) * ORBIT.radiusY,
    reachX: reach,
    reachY: reach,
    spansWidth: false,
    band: null,
    lane: null,
  };
}

/** Concentric bands from the inside out, each sized by its weight; radius plus stroke ≤ 0.76. */
export function coreSlots(weights: readonly number[], coreX: number): readonly Slot[] {
  const radius = Math.min(CORE_MAX_RADIUS, 1 - Math.abs(coreX) - 0.02);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let inner = CORE_INNER;
  return weights.map((weight) => {
    const outer = inner + ((radius - CORE_INNER) * weight) / total;
    const slot: Slot = { x: coreX, y: CORE_CENTRE_Y, reachX: outer, reachY: outer, spansWidth: false, band: { from: inner, to: outer }, lane: null };
    inner = outer;
    return slot;
  });
}

/**
 * The floor's cells: each member goes to the wing with more area per member (ties to the
 * arrangement's side), then each wing stacks its members in rows.
 */
export function wingSlots(wings: readonly [ExclusionBox, ExclusionBox], count: number, isMirrored: boolean): readonly Slot[] {
  const order: readonly [0 | 1, 0 | 1] = isMirrored ? [1, 0] : [0, 1];
  const counts = [0, 0];
  const owners: { readonly wing: 0 | 1; readonly row: number }[] = [];
  for (let index = 0; index < count; index += 1) {
    const [first, second] = order;
    const share = (wing: 0 | 1): number => boxArea(wings[wing]) / ((counts[wing] ?? 0) + 1);
    const pick = share(second) > share(first) ? second : first;
    owners.push({ wing: pick, row: counts[pick] ?? 0 });
    counts[pick] = (counts[pick] ?? 0) + 1;
  }
  return owners.map(({ wing, row }) => {
    const box = wings[wing];
    const height = (box.maxY - box.minY) / Math.max(1, counts[wing] ?? 1);
    return {
      x: (box.minX + box.maxX) / 2,
      y: box.minY + height * (row + 0.5),
      reachX: ((box.maxX - box.minX) / 2) * CELL_FILL,
      reachY: (height / 2) * CELL_FILL,
      spansWidth: false,
      band: null,
      lane: null,
    };
  });
}
