// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Keeps the keyboard inside the modal layer: aria-modal on the top sheet, the
// page behind it inert, and Tab and Shift+Tab cycling between its first and last stops.
// The top bar never goes inert (the export opens over the detail); it only leaves the Tab
// cycle. layerModality decides which sheet; this guard only applies it.

/**
 * Where Tab or Shift+Tab goes among `count` stops, from `index` (−1: the focus is on the
 * sheet's heading or outside the sheet). Null: the browser's own step stays inside.
 */
export function wrapIndex(count: number, index: number, isBackward: boolean): number | null {
  if (count === 0) return null;
  if (index < 0) return isBackward ? count - 1 : 0;
  if (isBackward) return index === 0 ? count - 1 : null;
  return index === count - 1 ? 0 : null;
}

const CANDIDATES = "button, [href], input, select, textarea, [tabindex]";

/** The stops Tab reaches inside `root`, in document order. */
export function tabbablesIn(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(CANDIDATES)].filter((node) =>
    node.tabIndex >= 0
    && !(node as HTMLButtonElement).disabled
    && node.closest("[inert]") === null
    && node.checkVisibility());
}

/**
 * The index wrapIndex steps from. A focused node inside the sheet that is no stop (the
 * heading, a roving radio) counts as the stop just before it going forward and the stop
 * just after it going backward, so the wrap happens only at the real ends.
 */
function stopIndex(root: HTMLElement, stops: readonly HTMLElement[], active: Element | null, isBackward: boolean): number {
  if (!(active instanceof HTMLElement) || !root.contains(active)) return -1;
  const index = stops.indexOf(active);
  if (index >= 0) return index;
  const before = stops.filter((stop) => (stop.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).length;
  return isBackward ? before : before - 1;
}

/**
 * The focus fell out of use: on the body, on `fallback` (where the shell parks a focus
 * whose control is gone), or on a node that no longer renders.
 */
export function isFocusLost(doc: Document, fallback: HTMLElement): boolean {
  const active = doc.activeElement;
  return active === null || active === doc.body || active === fallback || (active instanceof HTMLElement && !active.checkVisibility());
}

export interface ModalGuardOptions {
  readonly doc: Document;
  /** The page's main content: inert under a modal layer. */
  readonly main: HTMLElement;
  /** The tab bar: inert under a modal layer, and until the music runs. */
  readonly nav: HTMLElement;
}

export interface ModalState {
  /** The top modal sheet, or null when nothing is modal. */
  readonly root: HTMLElement | null;
  readonly trapsTab: boolean;
  readonly isRunning: boolean;
}

export interface ModalGuard {
  /** Call before any focus move of the same render: dismiss() checks for [inert]. */
  update(state: ModalState): void;
  destroy(): void;
}

export function createModalGuard({ doc, main, nav }: ModalGuardOptions): ModalGuard {
  let root: HTMLElement | null = null;
  let trapsTab = false;
  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== "Tab" || event.defaultPrevented || root === null || !trapsTab) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const stops = tabbablesIn(root);
    const next = wrapIndex(stops.length, stopIndex(root, stops, doc.activeElement, event.shiftKey), event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    stops[next]?.focus();
  };
  doc.addEventListener("keydown", onKey);
  return {
    update(state) {
      if (root !== state.root) root?.removeAttribute("aria-modal");
      root = state.root;
      trapsTab = state.trapsTab;
      root?.setAttribute("aria-modal", "true");
      main.inert = root !== null;
      nav.inert = !state.isRunning || root !== null;
    },
    destroy() {
      doc.removeEventListener("keydown", onKey);
      root?.removeAttribute("aria-modal");
      main.inert = false;
    },
  };
}
