// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { bindings } from "../copy/copy";

/** A text, or a reader of it that is read again on every language change. */
export type Label = string | (() => string);

/** Sets an attribute from a label, kept in the current language when it is a reader. */
export function labelAttribute(node: Element, name: string, label: Label): void {
  if (typeof label === "string") node.setAttribute(name, label);
  else bindings.attribute(node, name, label);
}

/** A small element factory: text is always set as text, never as markup. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: Label,
  ...children: readonly Node[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== "") node.className = className;
  if (typeof text === "function") bindings.text(node, text);
  else if (text !== undefined) node.textContent = text;
  node.append(...children);
  return node;
}

export function button(className: string, label: Label, onClick: () => void, ...children: readonly Node[]): HTMLButtonElement {
  const node = el("button", className, children.length === 0 ? label : undefined, ...children);
  node.type = "button";
  if (children.length > 0) labelAttribute(node, "aria-label", label);
  node.addEventListener("click", onClick);
  return node;
}

let counter = 0;

/** Unique ids for aria wiring, stable for the life of the page. */
export function uniqueId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}
