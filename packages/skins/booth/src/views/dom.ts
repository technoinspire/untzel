// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// Minimal DOM building blocks. No framework and no inline styles (CSP): every visual
// value lives in the CSS file next to the view (views/<view>.css) or in a shared
// primitive of styles/, and dynamic geometry goes through CSS custom properties set
// with style.setProperty, which CSP style-src allows. A text
// given as a reader (`text.play` of copy.ts) is bound: a language change rewrites it in
// place.
import { bindings, type Label } from "../copy/copy";

type Attributes = Readonly<Record<string, string | number | boolean | null | undefined | (() => string)>>;

export interface ElementOptions {
  readonly className?: string;
  readonly text?: Label;
  readonly attributes?: Attributes;
}

export function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
  children: readonly Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className !== undefined) node.className = options.className;
  if (typeof options.text === "function") bindings.text(node, options.text);
  else if (options.text !== undefined) node.textContent = options.text;
  if (options.attributes !== undefined) setAttributes(node, options.attributes);
  node.append(...children);
  return node;
}

export function button(
  className: string,
  label: Label,
  onClick: (event: MouseEvent) => void,
  children: readonly Node[] = [],
): HTMLButtonElement {
  const node = element("button", { className, attributes: { type: "button" } }, children);
  if (children.length === 0) setLabelText(node, label);
  else setLabelAttribute(node, "aria-label", label);
  node.addEventListener("click", onClick);
  return node;
}

export function setAttributes(node: Element, attributes: Attributes): void {
  for (const [name, value] of Object.entries(attributes)) {
    if (typeof value === "function") bindings.attribute(node, name, value);
    else if (value === null || value === undefined || value === false) node.removeAttribute(name);
    else node.setAttribute(name, value === true ? "" : String(value));
  }
}

function setLabelText(node: Node, label: Label): void {
  if (typeof label === "function") bindings.text(node, label);
  else node.textContent = label;
}

function setLabelAttribute(node: Element, name: string, label: Label): void {
  if (typeof label === "function") bindings.attribute(node, name, label);
  else node.setAttribute(name, label);
}

export function setText(node: Node, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

export function setPressed(node: HTMLElement, isPressed: boolean): void {
  node.setAttribute("aria-pressed", String(isPressed));
}

/** Sets a CSS custom property; the stylesheet decides what it means. */
export function setVar(node: HTMLElement, name: string, value: string | number): void {
  node.style.setProperty(name, String(value));
}

/**
 * Keyed reconciliation: keeps one node per key, in order, creating and removing as
 * needed. Existing nodes are updated in place, so focus survives a refresh.
 */
export function reconcile<T, N extends Element>(
  container: Element,
  items: readonly T[],
  keyOf: (item: T) => string,
  create: (item: T) => N,
  update: (node: N, item: T) => void,
  nodes: Map<string, N>,
  trailing: Element | null = null,
): void {
  const seen = new Set<string>();
  let cursor: Element | null = container.firstElementChild;
  for (const item of items) {
    const key = keyOf(item);
    seen.add(key);
    let node = nodes.get(key);
    if (node === undefined) {
      node = create(item);
      nodes.set(key, node);
    }
    update(node, item);
    if (node !== cursor) container.insertBefore(node, cursor);
    else cursor = cursor.nextElementSibling;
  }
  for (const [key, node] of nodes) {
    if (!seen.has(key)) {
      node.remove();
      nodes.delete(key);
    }
  }
  if (trailing !== null && container.lastElementChild !== trailing) container.append(trailing);
}
