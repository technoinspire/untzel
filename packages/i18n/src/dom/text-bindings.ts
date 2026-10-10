// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Text that follows the language: a node and how to read its text again. On a language
// change the owner calls refresh(). A node held only here is let go: a sheet that leaves
// the document and comes back keeps its binding, a tile of a deleted track is collected.

export type TextReader = () => string;

export interface TextBindings {
  /** Sets node.textContent from read now and on every refresh. */
  text(node: Node, read: TextReader): void;
  /** Sets the attribute from read now and on every refresh. */
  attribute(node: Element, name: string, read: TextReader): void;
  refresh(): void;
}

interface Binding<N extends Node> {
  readonly node: WeakRef<N>;
  /** Takes the node as an argument so the binding never keeps it alive. */
  readonly apply: (node: N) => void;
}

function setText(node: Node, read: TextReader): void {
  const value = read();
  if (node.textContent !== value) node.textContent = value;
}

function setAttribute(node: Element, name: string, read: TextReader): void {
  const value = read();
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function createTextBindings(): TextBindings {
  const bindings = new Set<Binding<Node>>();
  const add = <N extends Node>(node: N, apply: (target: N) => void): void => {
    apply(node);
    bindings.add({ node: new WeakRef(node), apply } as unknown as Binding<Node>);
  };
  return {
    text: (node, read) => add(node, (target) => setText(target, read)),
    attribute: (node, name, read) => add(node, (target: Element) => setAttribute(target, name, read)),
    refresh() {
      for (const binding of [...bindings]) {
        const node = binding.node.deref();
        if (node === undefined) bindings.delete(binding);
        else binding.apply(node);
      }
    },
  };
}
