// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, reconcile, setPressed, setText, setVar } from "../dom";
import { tileCaption, trackCountLabel } from "../../behavior/text/format";
import { icon } from "../icons";
import type { TrackIntents } from "@untzel/skin-contract";
import type { TrackView, UntzelView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { trackDotClass } from "../../behavior/color/track-dot";
import { HOLD_MS, TileGesture, clamp01, type GestureEffect } from "../../behavior/gestures/tile-gesture";
import { createMiniSteps, updateMiniSteps } from "../pattern/mini-steps-view";

export interface TrackGridCallbacks {
  readonly onTune: (track: string) => void;
  readonly onAddTrack: () => void;
}

export interface TrackGrid {
  readonly root: HTMLElement;
  update(view: UntzelView): void;
}

const TONE_KEY_STEP = 0.05;
const SVG = "http://www.w3.org/2000/svg";

/** Mobile and tablet grid of track tiles, always ending in Add track. */
// Over 40 lines: one grid built and updated, with the hidden-tile count it measures.
export function createTrackGrid(intents: TrackIntents, callbacks: TrackGridCallbacks): TrackGrid {
  const tiles = new Map<string, HTMLElement>();
  const add = button("ui-tile ui-tile--add", text.addTrack, callbacks.onAddTrack, [
    icon("plus"),
    element("span", { className: "ui-tile__name", text: text.addTrack }),
  ]);
  add.removeAttribute("aria-label");
  const list = element("div", { className: "ui-grid" }, [add]);
  const scroller = element("div", { className: "ui-grid__scroller" }, [list]);
  const count = element("p", { className: "ui-grid__count" });
  const root = element("section", { className: "ui-tracks", attributes: { "aria-label": text.tracks } }, [
    scroller,
    element("div", { className: "ui-grid__fade", attributes: { "aria-hidden": "true" } }),
    count,
  ]);
  let tracks: readonly TrackView[] = [];
  let section: string | null = null;

  let hidden = 0;
  const writeCount = (): void => setText(count, trackCountLabel(tracks.length, hidden, false));
  // Measured only after layout: a read right after update()'s writes forced a layout on
  // every view. The list grows with the tiles, the scroller with the screen.
  const measure = new ResizeObserver(() => {
    hidden = scroller.scrollHeight - scroller.clientHeight > 1 ? 1 : 0;
    writeCount();
  });
  measure.observe(scroller);
  measure.observe(list);

  return {
    root,
    update(view) {
      tracks = view.tracks;
      section = view.transport.section;
      list.dataset["solo"] = String(tracks.some((track) => track.isSoloed));
      reconcile(
        list,
        tracks,
        (track) => track.name,
        (track) => createTile(track.name, intents, callbacks, () => tracks.find((t) => t.name === track.name)),
        (node, track) => updateTile(node, track, section, view.transport.nextBar),
        tiles,
        add,
      );
      writeCount();
    },
  };
}

function createTile(
  name: string,
  intents: TrackIntents,
  callbacks: TrackGridCallbacks,
  current: () => TrackView | undefined,
): HTMLElement {
  const main = element("button", { className: "ui-tile__main", attributes: { type: "button" } }, [
    element("span", { className: "ui-tile__head" }, [
      element("span", { className: trackDotClass(name), attributes: { "aria-hidden": "true" } }),
      element("span", { className: "ui-tile__name" }),
      queueRing(),
    ]),
    element("span", { className: "ui-tile__caption" }),
    createMiniSteps("ui-tile__mini"),
  ]);
  const tune = button("ui-tile__tune", text.tuneTrack(name), () => callbacks.onTune(name), [icon("tune")]);
  bindGesture(main, name, intents, current);
  return element("div", { className: "ui-tile" }, [main, tune]);
}

// Over 40 lines: one gesture; press, hold to solo, release and the keys share its state.
function bindGesture(main: HTMLButtonElement, name: string, intents: TrackIntents, current: () => TrackView | undefined): void {
  const gesture = new TileGesture();
  let holdTimer: number | undefined;
  const apply = (effect: GestureEffect): void => {
    if (effect.kind === "toggle") intents.toggleTrack(name);
    else if (effect.kind === "tone") intents.setTone(name, effect.tone);
    else if (effect.kind === "solo") intents.setSolo(name, effect.isSoloed);
  };
  const clearHold = (): void => window.clearTimeout(holdTimer);

  main.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    main.setPointerCapture(event.pointerId);
    apply(gesture.down(event.clientY, current()?.tone ?? 0, event.pointerType !== "touch"));
    holdTimer = window.setTimeout(() => apply(gesture.hold()), HOLD_MS);
  });
  main.addEventListener("pointermove", (event) => {
    if (!gesture.isActive) return;
    const effect = gesture.move(event.clientY);
    if (effect.kind === "tone" || !gesture.isPressed) clearHold();
    apply(effect);
  });
  main.addEventListener("pointerup", () => {
    clearHold();
    apply(gesture.up());
  });
  main.addEventListener("pointercancel", () => {
    clearHold();
    apply(gesture.cancel());
  });
  // Keyboard activation arrives as a click with detail 0; pointer clicks were handled above.
  main.addEventListener("click", (event) => {
    if (event.detail === 0) intents.toggleTrack(name);
  });
  main.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const delta = event.key === "ArrowUp" ? TONE_KEY_STEP : -TONE_KEY_STEP;
    intents.setTone(name, clamp01((current()?.tone ?? 0) + delta));
  });
}

function queueRing(): SVGSVGElement {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ui-ring");
  for (const role of ["track", "fill"]) {
    const circle = document.createElementNS(SVG, "circle");
    circle.setAttribute("cx", "11");
    circle.setAttribute("cy", "11");
    circle.setAttribute("r", "8");
    circle.setAttribute("pathLength", "100");
    circle.classList.add(`ui-ring__${role}`);
    svg.append(circle);
  }
  return svg;
}

function updateTile(node: HTMLElement, track: TrackView, section: string | null, nextBar: number): void {
  node.dataset["state"] = track.playState;
  node.classList.toggle("is-soloed", track.isSoloed);
  node.classList.toggle("is-hinted", track.isHinted);
  const main = node.querySelector<HTMLButtonElement>(".ui-tile__main");
  if (main === null) return;
  setPressed(main, track.playState === "on");
  main.setAttribute("aria-label", `${track.name}, ${track.instrument}`);
  main.setAttribute("aria-description", tileCaption(track.instrument, track.playState, section));
  const name = main.querySelector(".ui-tile__name");
  const [, caption, mini] = Array.from(main.children);
  if (name !== null) setText(name, track.name);
  if (caption !== undefined) setText(caption, tileCaption(track.instrument, track.playState, section));
  if (mini instanceof HTMLElement) updateMiniSteps(mini, track.steps);
  // Only the queued tile's ring shows it: writing it on all 64 tiles restyled them every frame.
  if (track.playState === "queued") setVar(node, "--next-bar", nextBar.toFixed(3));
}
