// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { text } from "../../copy/copy";
import { element, reconcile, setText } from "../dom";
import { icon } from "../icons";
import type { StyleOption } from "./template-picker-model";

/** What the list shows: the open style when it is listed, else the first one; hidden without styles. */
export function styleListState(styles: readonly StyleOption[], openStyle: string): { readonly value: string; readonly isHidden: boolean } {
  const value = styles.some((style) => style.id === openStyle) ? openStyle : (styles[0]?.id ?? "");
  return { value, isHidden: styles.length === 0 };
}

/** The Style list: a labelled native select, one option per music style. Hidden without styles. */
export function createStyleList(selectId: string, open: (style: string) => void): {
  readonly root: HTMLElement;
  update(styles: readonly StyleOption[], openStyle: string): void;
} {
  const select = element("select", { className: "ui-styles__select", attributes: { id: selectId } });
  select.addEventListener("change", () => open(select.value));
  const field = element("div", { className: "ui-styles__field" }, [
    element("label", { className: "ui-styles__label", text: text.musicStyle, attributes: { for: selectId } }),
    element("span", { className: "ui-styles__choice" }, [select, icon("chevron")]),
  ]);
  const options = new Map<string, HTMLOptionElement>();
  const createOption = (style: StyleOption): HTMLOptionElement => element("option", { attributes: { value: style.id } });
  const updateOption = (node: HTMLOptionElement, style: StyleOption): void => {
    setText(node, style.label);
    node.selected = style.isOpen;
  };
  return {
    root: field,
    update: (styles, openStyle) => {
      reconcile(select, styles, (style) => style.id, createOption, updateOption, options);
      const state = styleListState(styles, openStyle);
      if (select.value !== state.value) select.value = state.value;
      field.hidden = state.isHidden;
    },
  };
}
