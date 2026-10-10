// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setText } from "../dom";
import { icon } from "../icons";
import type { ProjectListItem, UntzelView } from "@untzel/presentation/view-model";
import type { ProjectIntents } from "@untzel/skin-contract";
import { strings, text } from "../../copy/copy";
import { createProjectRow, type ProjectRow } from "./project-row";
import { createSheet, type Sheet } from "../sheets/sheet";
// The Projects sheet, opened by "Open project…": every project of this device,
// most recent first, with New project on top, a search above 8 projects, and the
// privacy note. Opening one stops the music cleanly and waits for Tap to play.
export const SEARCH_FROM = 9;
export interface ProjectsSheet extends Sheet {
  update(view: UntzelView): void;
}
/** Projects whose title contains the query, case and accents ignored. */
export function filterProjects(projects: readonly ProjectListItem[], query: string): readonly ProjectListItem[] {
  const fold = (text: string): string => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const wanted = fold(query.trim());
  return wanted === "" ? projects : projects.filter((project) => fold(project.title).includes(wanted));
}
type SheetIntents = Pick<ProjectIntents, "newProject" | "openProject" | "renameProject" | "duplicateProject" | "deleteProject" | "saveProjectFile">;
// Over 40 lines: one sheet and its list built and updated, nothing else.
export function createProjectsSheet(intents: SheetIntents, announce: (message: string) => void, onClose: () => void): ProjectsSheet {
  const sheet = createSheet({ id: "ui-projects", title: text.projects, className: "ui-sheet--projects", onClose });
  const create = button("ui-pill ui-pill--primary ui-projects__new", text.newProject, () => intents.newProject(), [icon("plus"), element("span", { text: text.newProject })]);
  create.removeAttribute("aria-label");
  const search = element("input", { className: "ui-projects__search", attributes: { type: "search", "aria-label": text.searchProjects, placeholder: text.searchProjects, autocomplete: "off" } });
  const list = element("ul", { className: "ui-projects__list", attributes: { "aria-label": text.projects } });
  const empty = element("p", { className: "ui-projects__empty" });
  const note = element("p", { className: "ui-projects__note", text: text.projectsPrivacy });
  sheet.body.append(create, search, list, empty, note);
  const rows = new Map<string, ProjectRow>();
  let projects: readonly ProjectListItem[] = [];
  // What was drawn last: the list and the language of its empty line. Null before the
  // first update, so an empty library still draws its line and hides the search.
  let drawn: string | null = null;
  const draw = (): void => {
    const shown = filterProjects(projects, search.value);
    rows.clear();
    list.replaceChildren();
    for (const item of shown) {
      const row = createProjectRow(item.id, intents, announce);
      row.update(item);
      rows.set(item.id, row);
      list.append(row.root);
    }
    empty.hidden = shown.length > 0;
    setText(empty, projects.length === 0 ? strings.noProjects : strings.noProjectsFound);
  };
  search.addEventListener("input", draw);
  return {
    ...sheet,
    update(view) {
      const next = `${strings.noProjects}\n${JSON.stringify(view.project.projects)}`;
      if (next === drawn) return;
      const isFirst = drawn === null;
      drawn = next;
      const ids = (list: readonly ProjectListItem[]): string => list.map((item) => item.id).join(" ");
      const isSameList = ids(view.project.projects) === ids(projects);
      projects = view.project.projects;
      search.hidden = projects.length < SEARCH_FROM;
      if (search.hidden) search.value = "";
      // The same projects: update the rows in place, so a focused button keeps its focus.
      if (isSameList && !isFirst) {
        for (const item of projects) rows.get(item.id)?.update(item);
        setText(empty, projects.length === 0 ? strings.noProjects : strings.noProjectsFound);
        return;
      }
      const hadFocus = list.contains(document.activeElement);
      draw();
      if (hadFocus) sheet.heading.focus({ preventScroll: true });
    },
  };
}
