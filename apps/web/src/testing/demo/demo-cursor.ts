// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The demo's visible hand: an arrow at the last pointer
// event and a ring where it pressed. A headless browser draws no cursor, so the video would
// show controls changing by themselves. The ring is timed by the page's clock, which the
// recorder advances frame by frame; under reduced motion it fades without growing.
const SVG_NS = "http://www.w3.org/2000/svg";

const RING_MS = 360;

const RING_SIZE = 44;

const RING_GROWTH = 0.6;

function arrow(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "28");
  svg.setAttribute("height", "28");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("d", "M4 2.5 L4 19 L8.6 14.9 L11.6 21.5 L14.6 20.2 L11.7 13.7 L17.8 13.4 Z");
  path.setAttribute("fill", "#ffffff");
  path.setAttribute("stroke", "#0b0b0c");
  path.setAttribute("stroke-width", "1.4");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}

function layer(): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("aria-hidden", "true");
  root.dataset["demoCursor"] = "";
  Object.assign(root.style, { position: "fixed", left: "0", top: "0", width: "0", height: "0", zIndex: "2147483645", pointerEvents: "none" });
  return root;
}

// Over 40 lines: test build only; one layer built and styled, which the pointer and the ring share.
export function createDemoCursor(host: HTMLElement): void {
  const root = layer();
  const pointer = arrow();
  Object.assign(pointer.style, { position: "absolute", left: "-4px", top: "-2px", filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))" });
  const ring = document.createElement("div");
  Object.assign(ring.style, {
    position: "absolute",
    width: `${RING_SIZE}px`,
    height: `${RING_SIZE}px`,
    left: `${-RING_SIZE / 2}px`,
    top: `${-RING_SIZE / 2}px`,
    borderRadius: "50%",
    border: "2px solid #ffffff",
    opacity: "0",
  });
  root.append(ring, pointer);
  host.append(root);
  const isReduced = (): boolean => document.documentElement.dataset["motion"] === "reduced" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  let pressedAt: number | null = null;
  const drawRing = (): void => {
    if (pressedAt === null) return;
    const progress = Math.min(1, (performance.now() - pressedAt) / RING_MS);
    // Exponential out, from a ring already on screen.
    const eased = 1 - 2 ** (-10 * progress);
    ring.style.opacity = String(0.9 * (1 - eased));
    ring.style.transform = `scale(${isReduced() ? 1 : 1 + RING_GROWTH * eased})`;
    if (progress < 1) requestAnimationFrame(drawRing);
    else pressedAt = null;
  };
  const follow = (event: PointerEvent): void => {
    root.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
  };

  addEventListener("pointermove", follow, { capture: true, passive: true });
  addEventListener(
    "pointerdown",
    (event) => {
      follow(event);
      const isDrawing = pressedAt !== null;
      pressedAt = performance.now();
      // A ring still fading starts over; its frame loop is already running.
      if (!isDrawing) drawRing();
    },
    { capture: true, passive: true },
  );
}
