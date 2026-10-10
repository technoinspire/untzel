// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { StepPitch } from "@untzel/core";
import { button, element, setPressed, setText, setVar } from "../dom";
import { icon } from "../icons";
import { strings } from "../../copy/copy";
import { pickerKeys, pitchLabel, pressedOutside, scaleWarning } from "./note-picker-model";
import { nextKeyIndex } from "../primitives/roving-keys";

export interface PianoKeys {
  /** The keys' scroller. */
  readonly root: HTMLElement;
  /** Octave − and +, around the span of the keys shown. */
  readonly lower: HTMLButtonElement;
  readonly span: HTMLElement;
  readonly higher: HTMLButtonElement;
  render(start: number, scale: readonly number[], scaleLabel: string, isLocked: boolean, sounding: StepPitch, pending: StepPitch | null): void;
}

/** The note picker's two octaves of keys and the octave window around them. */
// Over 40 lines: one keyboard built and drawn; drawing keeps the focused key under the finger.
export function createPianoKeys(onKey: (midi: number) => void, moveWindow: (delta: -1 | 1) => void, onWarning: (text: string) => void): PianoKeys {
  const lower = button("ui-round ui-round--raised ui-picker__octave", strings.octaveDown, () => moveWindow(-1), [icon("minus")]);
  const higher = button("ui-round ui-round--raised ui-picker__octave", strings.octaveUp, () => moveWindow(1), [icon("plus")]);
  const span = element("span", { className: "ui-picker__span" });
  const piano = element("div", { className: "ui-piano", attributes: { role: "group" } });
  piano.addEventListener("keydown", (event) => {
    const keys = Array.from(piano.querySelectorAll<HTMLButtonElement>(".ui-piano__key"));
    const index = nextKeyIndex(keys.indexOf(event.target as HTMLButtonElement), event.key, keys.length);
    if (index === null) return;
    event.preventDefault();
    const next = keys[index];
    keys.forEach((key) => (key.tabIndex = key === next ? 0 : -1));
    next?.focus();
  });
  return {
    root: element("div", { className: "ui-piano__scroller" }, [piano]),
    lower,
    span,
    higher,
    render(start, scale, scaleLabel, isLocked, sounding, pending) {
      // The view updates on every bar; the keys are drawn again only when they change, so a
      // key being pressed or focused is never replaced under the finger.
      const signature = `${start}|${pitchLabel(sounding)}|${pending === null ? "" : pitchLabel(pending)}|${scale.join(" ")}|${isLocked}`;
      if (piano.dataset["signature"] === signature) return;
      piano.dataset["signature"] = signature;
      const keys = pickerKeys({ start, scale, isScaleLocked: isLocked, sounding, pending });
      const focused = piano.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset["midi"] : undefined;
      piano.replaceChildren(...keys.map((key) => {
        const node = button(`ui-piano__key ${key.isBlack ? "ui-piano__key--black" : "ui-piano__key--white"}`, key.label, () => onKey(key.midi));
        node.textContent = key.name;
        node.setAttribute("aria-label", key.label);
        node.dataset["midi"] = String(key.midi);
        node.dataset["scale"] = String(key.isInScale);
        node.classList.toggle("is-dimmed", key.isDimmed);
        node.classList.toggle("is-root", key.isRoot);
        node.classList.toggle("is-pending", key.isPending);
        setVar(node, "--white-before", key.whiteBefore);
        setPressed(node, key.isPressed);
        node.tabIndex = key.isPressed || key.isPending ? 0 : -1;
        return node;
      }));
      // One tab stop: the pressed or chosen key, else the first key of the window.
      if (!keys.some((key) => key.isPressed || key.isPending)) piano.querySelector<HTMLElement>(".ui-piano__key")?.setAttribute("tabindex", "0");
      piano.setAttribute("aria-label", `Keys, ${keys[0]?.name ?? ""} to ${keys.at(-1)?.name ?? ""}`);
      setText(span, `${keys[0]?.name ?? ""}–${keys.at(-1)?.name ?? ""}`);
      if (focused !== undefined) piano.querySelector<HTMLElement>(`[data-midi="${focused}"]`)?.focus();
      revealLitKey(piano);
      onWarning(scaleWarning(keys.find((key) => key.isPending), scaleLabel) ?? "");
      const outside = pressedOutside(sounding, start);
      setOctaveMark(lower, strings.octaveDown, outside.below, strings.moreBelow);
      setOctaveMark(higher, strings.octaveUp, outside.above, strings.moreAbove);
    },
  };
}

/** On a narrow screen the keys scroll: bring the first pressed or chosen key into view. */
function revealLitKey(piano: HTMLElement): void {
  const scroller = piano.parentElement;
  const key = piano.querySelector<HTMLElement>('[aria-pressed="true"], .is-pending');
  if (scroller === null || key === null) return;
  // The keyboard is position: relative, so offsetLeft counts from its left edge.
  const left = key.offsetLeft;
  const right = left + key.offsetWidth;
  if (left < scroller.scrollLeft || right > scroller.scrollLeft + scroller.clientWidth) {
    scroller.scrollLeft = Math.max(0, left - (scroller.clientWidth - key.offsetWidth) / 2);
  }
}

/** The octave buttons say when pressed keys lie past them. */
function setOctaveMark(node: HTMLElement, label: string, hasMore: boolean, more: string): void {
  node.dataset["more"] = String(hasMore);
  node.setAttribute("aria-label", hasMore ? `${label}, ${more}` : label);
}
