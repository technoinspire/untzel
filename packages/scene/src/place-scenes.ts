// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { SceneDescription } from "./choose-scene";
import { floorWings } from "./floor-wings";
import type { KeepOut } from "./keep-out";
import type { SceneZone } from "./scene-catalog";
import type { StagePlan } from "./stage-plan";
import {
  CORE_CENTRE_Y,
  CORE_OFFSET,
  coreSlots,
  laneSlot,
  orbitSlot,
  rowSlot,
  wingSlots,
  type Interval,
  type Row,
  type Slot,
} from "./zone-layouts";
// placeScenes(descriptions, plan, keepOut) → one anchor per track. Runs once per
// program over EVERY track of the text, audible or not, so mute and solo never move an
// anchor. Every anchor and reach is in the composition square [−1, 1]² (u = half the safe
// area's shorter side), so no stage size comes in and every format gets the same numbers.

export interface SceneAnchor extends Slot {
  readonly zone: SceneZone;
  /** The plan's 0.85..1.15 for the member's family. */
  readonly scale: number;
  /** The track's rotation plus the plan's phase, radians. */
  readonly rotation: number;
}

const ROWS: Readonly<Partial<Record<SceneZone, Row>>> = {
  sky: { x: { from: -0.9, to: 0.9 }, y: { from: -0.76, to: -0.54 } },
  wall: { x: { from: -0.88, to: 0.88 }, y: { from: -0.52, to: -0.16 } },
  field: { x: { from: -0.6, to: 0.6 }, y: { from: -0.4, to: 0.2 } },
};
const LANES: Readonly<Partial<Record<SceneZone, Interval>>> = {
  horizon: { from: -0.06, to: 0.16 },
  ground: { from: 0.18, to: 0.41 },
};
/** Inner to outer, and the share of the core's radius each shape asks for. */
const CORE_ORDER: Readonly<Record<string, number>> = { triple: 0, shards: 1, arcs: 2, halo: 3, blast: 4 };
const CORE_WEIGHT: Readonly<Record<string, number>> = { triple: 4, shards: 1.2, arcs: 1, halo: 1.2, blast: 1.6 };
/** Sweeps cross the whole square on their drive; they take no cell. */
const SWEEP_SLOT: Slot = { x: 0, y: 0, reachX: 1, reachY: 0.95, spansWidth: true, band: null, lane: null };

export function coreCentre(plan: StagePlan): { readonly x: number; readonly y: number } {
  return { x: plan.isCoreOffset ? CORE_OFFSET * (plan.isMirrored ? -1 : 1) : 0, y: CORE_CENTRE_Y };
}

export function placeScenes(descriptions: readonly SceneDescription[], plan: StagePlan, keepOut: KeepOut): ReadonlyMap<string, SceneAnchor> {
  const anchors = new Map<string, SceneAnchor>();
  const coreX = coreCentre(plan).x;
  for (const [zone, members] of byZone(descriptions)) {
    const ordered = [...members].sort(byLook);
    for (const sweep of ordered.filter(isSweep)) anchors.set(sweep.track, finish(sweep, plan, SWEEP_SLOT));
    const placed = ordered.filter((member) => !isSweep(member));
    const slots = zoneSlots(zone, placed, plan, coreX, keepOut);
    placed.forEach((member, index) => {
      const slot = slots[index];
      if (slot !== undefined) anchors.set(member.track, finish(member, plan, slot));
    });
  }
  return anchors;
}

/** The slots of a zone's members, in the members' order. */
function zoneSlots(zone: SceneZone, members: readonly SceneDescription[], plan: StagePlan, coreX: number, keepOut: KeepOut): readonly Slot[] {
  const count = members.length;
  if (count === 0) return [];
  const start = Math.floor(plan.zoneStart[zone] * count);
  const slotOf = (index: number): number => (index + start) % count;
  if (zone === "core") return coreMembers(members, coreX);
  if (zone === "floor") {
    const cells = wingSlots(floorWings(keepOut.brandZones), count, plan.isMirrored);
    return members.map((_, index) => cells[slotOf(index)] as Slot);
  }
  if (zone === "orbit") return members.map((_, index) => orbitSlot(slotOf(index), count, plan.isMirrored, coreX));
  const lane = LANES[zone];
  if (lane !== undefined) return members.map((_, index) => laneSlot(lane, slotOf(index), count));
  const row = ROWS[zone] as Row;
  return members.map((member, index) => rowSlot(row, slotOf(index), count, plan.isMirrored, member.phase, member.pan));
}

/** The core's bands go by shape, not by the zone's start: the kick's rings are always innermost. */
function coreMembers(members: readonly SceneDescription[], coreX: number): readonly Slot[] {
  const ordered = [...members].sort((a, b) => (CORE_ORDER[a.shape] ?? 9) - (CORE_ORDER[b.shape] ?? 9) || byLook(a, b));
  const slots = coreSlots(ordered.map((member) => CORE_WEIGHT[member.shape] ?? 1), coreX);
  return members.map((member) => slots[ordered.indexOf(member)] as Slot);
}

function finish(member: SceneDescription, plan: StagePlan, slot: Slot): SceneAnchor {
  return { ...slot, zone: member.zone, scale: plan.familyScale[member.family], rotation: member.rotation + plan.rotationPhase };
}

function byZone(descriptions: readonly SceneDescription[]): ReadonlyMap<SceneZone, SceneDescription[]> {
  const zones = new Map<SceneZone, SceneDescription[]>();
  for (const description of descriptions) {
    const members = zones.get(description.zone) ?? [];
    members.push(description);
    zones.set(description.zone, members);
  }
  return zones;
}

function byLook(a: SceneDescription, b: SceneDescription): number {
  return a.lookSeed - b.lookSeed || (a.track < b.track ? -1 : a.track > b.track ? 1 : 0);
}

function isSweep(description: SceneDescription): boolean {
  return description.family === "sweep";
}

/** Overlap of two members of a zone, as a share of the smaller one. */
export function overlapShare(a: Slot, b: Slot): number {
  if (a.band !== null && b.band !== null) return intervalShare(a.band, b.band);
  if (a.lane !== null && b.lane !== null) return intervalShare(a.lane, b.lane);
  if (a.spansWidth || b.spansWidth) return 0;
  const overlapX = Math.max(0, Math.min(a.x + a.reachX, b.x + b.reachX) - Math.max(a.x - a.reachX, b.x - b.reachX));
  const overlapY = Math.max(0, Math.min(a.y + a.reachY, b.y + b.reachY) - Math.max(a.y - a.reachY, b.y - b.reachY));
  const smaller = Math.min(4 * a.reachX * a.reachY, 4 * b.reachX * b.reachY);
  return smaller > 0 ? (overlapX * overlapY) / smaller : 0;
}

function intervalShare(a: Interval, b: Interval): number {
  const overlap = Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));
  return overlap / Math.max(1e-9, Math.min(a.to - a.from, b.to - b.from));
}
