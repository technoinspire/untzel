// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/** How far a block must rise so its bottom sits 8 px above the visible viewport's bottom. */
export function liftFor(blockBottom: number, visibleBottom: number): number {
  const overlap = blockBottom - visibleBottom + 8;
  return overlap > 0 ? Math.round(overlap) : 0;
}

/**
 * Phone: with the system keyboard open, the command line rides just above it
 * (visualViewport). Assumed on iPhone and Android, to be measured on real
 * devices. Returns the cleanup.
 */
export function liftAboveKeyboard(block: HTMLElement, input: HTMLInputElement): () => void {
  const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
  if (viewport === undefined || viewport === null) return () => undefined;
  const place = (): void => {
    block.style.removeProperty("--ut-lift");
    if (document.activeElement !== input) return;
    const lift = liftFor(block.getBoundingClientRect().bottom, viewport.offsetTop + viewport.height);
    if (lift > 0) block.style.setProperty("--ut-lift", `${lift}px`);
  };
  viewport.addEventListener("resize", place);
  viewport.addEventListener("scroll", place);
  input.addEventListener("focus", place);
  input.addEventListener("blur", place);
  return () => {
    viewport.removeEventListener("resize", place);
    viewport.removeEventListener("scroll", place);
  };
}
