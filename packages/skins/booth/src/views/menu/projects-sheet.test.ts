// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ProjectListItem } from "@untzel/presentation/view-model";
import { SEARCH_FROM, filterProjects } from "./projects-sheet";
import { projectRowDetail } from "./project-row";
const item = (id: string, title: string): ProjectListItem => ({ id, title, edited: "Edited now", detail: null, isOpen: false });
const PROJECTS = [item("a", "Midnight Coast"), item("b", "Ação à noite"), item("c", "Night Drive")];
describe("filterProjects", () => {
  it("keeps the titles that contain the query, ignoring case and accents", () => {
    expect(filterProjects(PROJECTS, "night").map((project) => project.id)).toEqual(["a", "c"]);
    expect(filterProjects(PROJECTS, "ACAO").map((project) => project.id)).toEqual(["b"]);
    expect(filterProjects(PROJECTS, "  ")).toBe(PROJECTS);
  });
  it("searching starts above 8 projects", () => {
    expect(SEARCH_FROM).toBe(9);
  });
});
describe("projectRowDetail", () => {
  it("says when it was edited and, once read, its tempo and tracks", () => {
    expect(projectRowDetail({ edited: "Edited 3 min ago", detail: null })).toBe("Edited 3 min ago");
    expect(projectRowDetail({ edited: "Edited 3 min ago", detail: "124 BPM · 6 tracks" })).toBe("Edited 3 min ago · 124 BPM · 6 tracks");
  });
});
