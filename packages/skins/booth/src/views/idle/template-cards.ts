// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element, reconcile, setPressed, setText } from "../dom";
import type { ProjectCard } from "./template-picker-model";

/** " · 124 BPM · c minor" after a card's name; nothing when the card has no detail. */
export function cardDetailText(detail: string | null): string {
  return detail === null ? "" : ` · ${detail}`;
}

/** The open style's projects: one card each, the chosen one pressed, a group named by the picker's label. */
export function createTemplateCards(labelId: string, select: (template: string) => void): {
  readonly root: HTMLElement;
  update(cards: readonly ProjectCard[]): void;
} {
  const panel = element("div", { className: "ui-styles__cards", attributes: { role: "group", "aria-labelledby": labelId } });
  const cards = new Map<string, HTMLButtonElement>();
  const createCard = (card: ProjectCard): HTMLButtonElement => {
    const node = element("button", { className: "ui-pill ui-pill--chip ui-styles__card", attributes: { type: "button" } }, [
      element("span", { className: "ui-styles__name" }),
      element("span", { className: "ui-styles__detail" }),
    ]);
    node.addEventListener("click", () => select(card.template));
    return node;
  };
  const updateCard = (node: HTMLButtonElement, card: ProjectCard): void => {
    const [name, detail] = node.children;
    if (name !== undefined) setText(name, card.name);
    if (detail !== undefined) setText(detail, cardDetailText(card.detail));
    setPressed(node, card.isSelected);
  };
  return {
    root: panel,
    update: (next) => reconcile(panel, next, (card) => card.template, createCard, updateCard, cards),
  };
}
