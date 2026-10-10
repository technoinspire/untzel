// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import type { ProjectRecord } from "@untzel/session/projects";
import { describe, expect, it } from "vitest";
import { editedLabel, projectFileName, projectView } from "./project-view";

const NOW = new Date(Date.UTC(2026, 9, 3, 16, 3));
const record = (id: string, title: string | null, updatedAt: string): ProjectRecord => ({ id, source: "", title, createdAt: updatedAt, updatedAt, templateOrigin: null });

describe("editedLabel", () => {
  it("says how long ago, then the date", () => {
    expect(editedLabel(NOW, "2026-10-03T16:02:40.000Z")).toBe("Edited just now");
    expect(editedLabel(NOW, "2026-10-03T16:00:00.000Z")).toBe("Edited 3 min ago");
    expect(editedLabel(NOW, "2026-10-03T11:00:00.000Z")).toBe("Edited 5 h ago");
    expect(editedLabel(NOW, "2026-09-28T11:00:00.000Z")).toBe("Edited on Sep 28");
  });
});

describe("projectView", () => {
  it("lists the records with their titles, marks the open one and offers the latest to continue", () => {
    const view = projectView({
      records: [record("a", "Night Drive", "2026-10-03T16:00:00.000Z"), record("b", null, "2026-10-02T10:00:00.000Z")],
      title: "Night Drive",
      openId: "a",
      saveState: "saved",
      isStorageBlocked: false,
      detailOf: (entry) => (entry.id === "a" ? "124 BPM · 6 tracks" : null),
      now: NOW,
    });
    expect(view.projects.map((entry) => [entry.title, entry.isOpen, entry.detail])).toEqual([
      ["Night Drive", true, "124 BPM · 6 tracks"],
      ["Untitled", false, null],
    ]);
    expect(view.latest).toEqual({ id: "a", title: "Night Drive" });
    expect(view.fileName).toBe("night-drive.untzel");
  });
  it("with nothing stored and no project open: no title, nothing to continue", () => {
    const view = projectView({ records: [], title: null, openId: null, saveState: null, isStorageBlocked: true, detailOf: () => null, now: NOW });
    expect(view).toMatchObject({ title: null, latest: null, isStorageBlocked: true, projects: [] });
  });
  it("the file is named from the title, or dated without one", () => {
    expect(projectFileName("Ação à Noite", NOW)).toBe("acao-a-noite.untzel");
    expect(projectFileName(null, new Date(2026, 9, 3, 16, 3))).toBe("untzel-20261003-1603.untzel");
  });
});
