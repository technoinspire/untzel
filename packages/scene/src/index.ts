// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// @untzel/scene: the light's domain, pure. Which scene each track draws, where it
// sits in the composition square, the seeds and the palette. No DOM, no WebGL, no clock.
export {
  chooseScene,
  type SceneDescription,
  type SceneManifest,
  type SceneSeeds,
  type SceneTrack,
} from "./choose-scene";
export { FLOOR_WING, boxArea, floorWings } from "./floor-wings";
export {
  TOP_CHROME_KEEP_OUT_Y,
  distanceToBox,
  fileKeepOut,
  overlapsBox,
  screenKeepOut,
  skyAtmosphereLine,
  type ExclusionBox,
  type KeepOut,
} from "./keep-out";
export { coreCentre, overlapShare, placeScenes, type SceneAnchor } from "./place-scenes";
export { SCENE_ZONES, zoneOf, type SceneZone } from "./scene-catalog";
export { CATEGORY_DEFAULTS, categoryOf, type SceneCategory } from "./scene-defaults";
export { LOOK_SALT, SCENE_SALT, eventRandom, lookSeed, sceneSeed } from "./scene-seeds";
export { SECTION_SALT, sectionHueShift } from "./section-shift";
export { ARRANGEMENT_COUNT, PLAN_SALT, stagePlan, type StagePlan } from "./stage-plan";
export { CORE_CENTRE_Y, CORE_MAX_RADIUS, type Interval, type Slot } from "./zone-layouts";
