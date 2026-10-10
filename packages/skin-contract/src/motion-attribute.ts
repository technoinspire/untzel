// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The page publishes the effective reduced motion on the root as data-motion,
// before the first paint and on every change. The stylesheet and the sheet's drag
// read it, so there is one source. With no attribute (the UI preview, a test), motion
// is full.
export const MOTION_ATTRIBUTE = "motion";
export function writeMotionAttribute(doc: Document, isReduced: boolean): void {
  doc.documentElement.dataset[MOTION_ATTRIBUTE] = motionAttributeValue(isReduced);
}
export function isReducedMotionDocument(doc: Document): boolean {
  return doc.documentElement.dataset[MOTION_ATTRIBUTE] === "reduced";
}
export function motionAttributeValue(isReduced: boolean): "reduced" | "full" {
  return isReduced ? "reduced" : "full";
}
