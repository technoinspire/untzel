// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { button, element, setAttributes, setText } from "../dom";
import { icon, type IconName } from "../icons";
import type { ProjectIntents } from "@untzel/skin-contract";
import type { ProjectListItem } from "@untzel/presentation/view-model";
import { phrases, strings } from "../../copy/copy";
import { createInlineName } from "../primitives/inline-name";
// One stored project in the Projects sheet: its title opens it; Rename, Duplicate,
// Save file and Delete sit beside it as 44 px buttons named after the project. Rename is
// the interface's one InlineName, of the title kind (60 code points, empty refused), whose
// idle button the row hides: the row's own title opens the project instead.

export interface ProjectRow {
  readonly root: HTMLLIElement;
  update(item: ProjectListItem): void;
}

/** The row's second line: when it was edited and, once read, its tempo and tracks. */
export function projectRowDetail(item: Pick<ProjectListItem, "edited" | "detail">): string {
  return item.detail === null ? item.edited : `${item.edited} · ${item.detail}`;
}

type RowIntents = Pick<ProjectIntents, "openProject" | "renameProject" | "duplicateProject" | "deleteProject" | "saveProjectFile">;

export function createProjectRow(id: string, intents: RowIntents, announce: (message: string) => void): ProjectRow {
  const title = element("span", { className: "ui-project__title" });
  const detail = element("span", { className: "ui-project__detail" });
  const open = button("ui-project__open", "", () => intents.openProject(id), [title, detail]);
  const name = createInlineName({ kind: "title", id: `ui-project-${id}`, onRename: (next) => intents.renameProject(id, next), announce });
  name.root.classList.add("ui-project__name");
  const action = (iconName: IconName, run: () => void): HTMLButtonElement => button("ui-round ui-project__action", "", run, [icon(iconName)]);
  const rename = action("pencil", () => name.edit());
  const duplicate = action("duplicate", () => intents.duplicateProject(id));
  const save = action("save-file", () => intents.saveProjectFile(id));
  const remove = action("trash", () => intents.deleteProject(id));
  remove.classList.add("ui-project__action--danger");
  const actions = element("div", { className: "ui-project__actions", attributes: { role: "group" } }, [rename, duplicate, save, remove]);
  const root = element("li", { className: "ui-project" }, [open, name.root, actions]);
  return {
    root,
    update(item) {
      setText(title, item.title);
      setText(detail, projectRowDetail(item));
      name.update(item.title, new Set());
      root.dataset["open"] = String(item.isOpen);
      setAttributes(open, { "aria-current": item.isOpen ? "true" : null });
      for (const [node, label] of [[rename, strings.renameAction], [duplicate, strings.duplicate], [save, strings.saveFile], [remove, strings.delete]] as const) {
        node.setAttribute("aria-label", `${label} ${item.title}`);
      }
      setAttributes(actions, { "aria-label": phrases.projectActions(item.title) });
    },
  };
}
