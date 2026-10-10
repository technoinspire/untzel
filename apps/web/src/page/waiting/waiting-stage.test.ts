// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { WaitingStage } from "./waiting-stage";

const catalog = {
  blank: null,
  styles: [{ id: "melodic-techno", label: "Melodic techno" }, { id: "deep-house", label: "Deep house" }],
  projects: [
    { id: "onboard", style: "melodic-techno", name: "Midnight Bloom", summary: null },
    { id: "garden", style: "deep-house", name: "Night Garden", summary: null },
  ],
};
const options = { catalog, choice: { template: "onboard", openStyle: null } };

describe("WaitingStage", () => {
  it("the tap plays the template, or what was received", () => {
    const stage = new WaitingStage(options);
    expect(stage.tap("garden")).toEqual({ kind: "template", name: "garden" });
    expect(stage.receive({ source: "tempo 120\n", origin: "link", mode: "loop", range: null })).toEqual({ kind: "remix", from: "link" });
    expect(stage.tap("onboard")).toEqual({ kind: "text", source: "tempo 120\n", origin: "link", mode: "loop", range: null });
  });

  it("choosing a template leaves the received text and its notice behind", () => {
    const stage = new WaitingStage(options);
    stage.receive({ source: "tempo 120\n", origin: "file", mode: null, range: null });
    expect(stage.view("idle").templates.notice).toEqual({ kind: "remix", from: "file" });
    stage.selectTemplate("garden");
    expect(stage.view("idle").templates).toMatchObject({ selected: "garden", notice: null });
    expect(stage.tap("garden")).toEqual({ kind: "template", name: "garden" });
  });

  it("a project opened from the menu waits for the tap; a template choice leaves it", () => {
    const stage = new WaitingStage(options);
    stage.openProject("p1");
    // The project is what plays: no template is marked, and the tap keeps the last choice.
    expect(stage.view("idle").templates.selected).toBe("");
    expect(stage.tap("")).toEqual({ kind: "project", id: "p1" });
    expect(stage.choice.template).toBe("onboard");
    stage.selectTemplate("garden");
    expect(stage.tap("garden")).toEqual({ kind: "template", name: "garden" });
    stage.openProject("p2");
    stage.receive({ source: "tempo 120\n", origin: "link", mode: null, range: null });
    expect(stage.tap("onboard")).toMatchObject({ kind: "text", origin: "link" });
  });

  it("a failure notice keeps what was received", () => {
    const stage = new WaitingStage(options);
    stage.receive({ source: "tempo 120\n", origin: "link", mode: "song", range: null });
    stage.setNotice({ kind: "failed", message: "This link could not be opened." });
    expect(stage.tap("onboard")).toEqual({ kind: "text", source: "tempo 120\n", origin: "link", mode: "song", range: null });
  });

  it("remembers the style tab and the template chosen, and takes the tempo and key later", () => {
    const stage = new WaitingStage(options);
    stage.openTemplateStyle("deep-house");
    stage.selectTemplate("garden");
    expect(stage.choice).toEqual({ template: "garden", openStyle: "deep-house" });
    expect(stage.view("idle").templates).toMatchObject({ selected: "garden", openStyle: "deep-house" });
    const described = { ...catalog, projects: catalog.projects.map((project) => ({ ...project, summary: { bpm: 124, key: { tonic: 2, scale: "dorian" as const } } })) };
    stage.setCatalog(described);
    expect(stage.view("idle").templates.catalog).toBe(described);
  });
});
