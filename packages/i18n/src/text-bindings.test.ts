// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { createTextBindings } from "./dom/text-bindings";

/** The slice of a DOM node the bindings touch. */
class FakeNode {
  textContent: string | null = "";
  readonly #attributes = new Map<string, string>();
  getAttribute(name: string): string | null {
    return this.#attributes.get(name) ?? null;
  }
  setAttribute(name: string, value: string): void {
    this.#attributes.set(name, value);
  }
}

describe("createTextBindings", () => {
  it("writes now and rewrites text and attributes on refresh", () => {
    let language = "en";
    const bindings = createTextBindings();
    const node = new FakeNode();
    bindings.text(node as unknown as Node, () => (language === "en" ? "Play" : "Tocar"));
    bindings.attribute(node as unknown as Element, "aria-label", () => (language === "en" ? "Close" : "Fechar"));
    expect(node.textContent).toBe("Play");
    expect(node.getAttribute("aria-label")).toBe("Close");
    language = "pt-BR";
    bindings.refresh();
    expect(node.textContent).toBe("Tocar");
    expect(node.getAttribute("aria-label")).toBe("Fechar");
  });

  it("keeps the binding of a node that is out of the document but still held", () => {
    let label = "a";
    const bindings = createTextBindings();
    const detached = new FakeNode();
    bindings.text(detached as unknown as Node, () => label);
    label = "b";
    bindings.refresh();
    expect(detached.textContent).toBe("b");
  });
});
