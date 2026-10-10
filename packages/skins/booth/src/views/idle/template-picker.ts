// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The template picker: a Style list, in alphabetical order with the number of
// projects of each, and the open style's projects as cards with their tempo and key. It is
// a native select: twelve styles no longer fit one row of tabs
// on a 1440 px screen, a second row pushed the picker over Tap to play, and a select
// grows to any number of styles, opens the phone's own wheel and jumps by first letter
// from the keyboard. A dumb view: it renders templatePickerModel and emits selectTemplate
// and openTemplateStyle. The project menu's "New project" reuses it.

import { element, setPressed, setText } from "../dom";
import { icon } from "../icons";
import type { SessionIntents } from "@untzel/skin-contract";
import type { TemplatesView } from "@untzel/presentation/view-model";
import { createStyleList } from "./style-list";
import { createTemplateCards } from "./template-cards";
import { templatePickerModel } from "./template-picker-model";

export interface TemplatePicker {
  readonly root: HTMLElement;
  /** The Blank card: the screen places it above "Start from a template". */
  readonly blank: HTMLElement;
  update(templates: TemplatesView): void;
}

type PickerIntents = Pick<SessionIntents, "selectTemplate" | "openTemplateStyle">;

export function createTemplatePicker(labelId: string, intents: PickerIntents): TemplatePicker {
  const styleList = createStyleList(`${labelId}-style`, (style) => intents.openTemplateStyle(style));
  const panel = createTemplateCards(labelId, (template) => intents.selectTemplate(template));
  // The Blank project: its own card, before the styles.
  const blankName = element("span", { className: "ui-styles__name" });
  const blankDetail = element("span", { className: "ui-styles__detail" });
  const blank = element("button", { className: "ui-pill ui-pill--chip ui-styles__card ui-styles__blank", attributes: { type: "button" } }, [
    icon("blank"),
    element("span", { className: "ui-styles__blank-text" }, [blankName, blankDetail]),
    icon("check"),
  ]);
  let blankId = "";
  blank.addEventListener("click", () => intents.selectTemplate(blankId));
  const root = element("div", { className: "ui-styles" }, [styleList.root, panel.root]);
  return {
    root,
    blank,
    update(templates) {
      const model = templatePickerModel(templates.catalog, { template: templates.selected, openStyle: templates.openStyle });
      blank.hidden = model.blank === null;
      if (model.blank !== null) {
        blankId = model.blank.template;
        setText(blankName, model.blank.name);
        setText(blankDetail, model.blank.detail ?? "");
        setPressed(blank, model.blank.isSelected);
      }
      styleList.update(model.styles, model.openStyle);
      panel.update(model.cards);
    },
  };
}
