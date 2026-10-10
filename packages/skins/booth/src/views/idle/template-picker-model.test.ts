// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { TemplateCatalogView, TemplateProjectView } from "@untzel/presentation/view-model";
import { idlePlayLabels, summaryDetail, templatePickerModel } from "./template-picker-model";

const project = (id: string, name: string, summary: TemplateProjectView["summary"] = null): TemplateProjectView => ({
  id,
  style: id.split("/")[0] ?? "",
  name,
  summary,
});

const CATALOG: TemplateCatalogView = {
  blank: { id: "blank", style: "", name: "Blank", summary: { bpm: 124, key: { tonic: 9, scale: "minor" } } },
  styles: [
    { id: "melodic-techno", label: "Melodic techno" },
    { id: "house", label: "House" },
    { id: "jungle", label: "Jungle" },
    { id: "psytrance", label: "Psytrance" },
  ],
  projects: [
    project("melodic-techno/midnight-bloom", "Midnight Bloom", { bpm: 124, key: { tonic: 9, scale: "minor" } }),
    project("house/sunday-piano", "Sunday Piano", { bpm: 125, key: { tonic: 5, scale: "major" } }),
    project("house/disco-lights", "Disco Lights", { bpm: 118, key: { tonic: 7, scale: "major" } }),
    project("house/golden-hour", "Golden Hour"),
    project("psytrance/full-moon", "Full Moon", { bpm: 145, key: { tonic: 6, scale: "phrygian" } }),
  ],
};

describe("templatePickerModel", () => {
  it("lists every style with projects alphabetically, with its project count, the selected template's style open", () => {
    const model = templatePickerModel(CATALOG, { template: "melodic-techno/midnight-bloom", openStyle: null });
    expect(model.styles.map((style) => style.label)).toEqual(["House · 3 projects", "Melodic techno · 1 project", "Psytrance · 1 project"]);
    expect(model.styles.filter((style) => style.isOpen).map((style) => style.id)).toEqual(["melodic-techno"]);
    expect(model.openStyle).toBe("melodic-techno");
    expect(model.cards).toEqual([{ template: "melodic-techno/midnight-bloom", name: "Midnight Bloom", detail: "124 BPM · a minor", isSelected: true }]);
  });

  it("sorts the names as a person reads them, whatever the case and the catalog order", () => {
    const catalog: TemplateCatalogView = {
      blank: null,
      styles: [{ id: "trance", label: "Trance" }, { id: "acid-techno", label: "Acid techno" }, { id: "afro-house", label: "afro house" }, { id: "amapiano", label: "Amapiano" }],
      projects: [project("trance/a", "A"), project("acid-techno/b", "B"), project("afro-house/c", "C"), project("amapiano/d", "D")],
    };
    expect(templatePickerModel(catalog, { template: "trance/a", openStyle: null }).styles.map((style) => style.id)).toEqual(["acid-techno", "afro-house", "amapiano", "trance"]);
  });
  it("lists every project of the open style by name, tempo and key, in the style's own order", () => {
    const model = templatePickerModel(CATALOG, { template: "melodic-techno/midnight-bloom", openStyle: "house" });
    expect(model.styles.find((style) => style.isOpen)?.id).toBe("house");
    expect(model.cards.map((card) => [card.name, card.detail])).toEqual([
      ["Sunday Piano", "125 BPM · f major"],
      ["Disco Lights", "118 BPM · g major"],
      ["Golden Hour", null],
    ]);
    expect(model.cards.every((card) => !card.isSelected)).toBe(true);
  });

  it("opens the selected template's style when the style asked for has no projects or does not exist", () => {
    expect(templatePickerModel(CATALOG, { template: "psytrance/full-moon", openStyle: "jungle" }).openStyle).toBe("psytrance");
    expect(templatePickerModel(CATALOG, { template: "psytrance/full-moon", openStyle: "gone" }).openStyle).toBe("psytrance");
  });

  it("opens the first style of the list when the selected template is not in the catalog, and is empty without styles", () => {
    expect(templatePickerModel(CATALOG, { template: "phase1-onboard", openStyle: null }).openStyle).toBe("house");
    expect(templatePickerModel({ blank: null, styles: [], projects: [] }, { template: "x", openStyle: null })).toEqual({ blank: null, openStyle: "", styles: [], cards: [] });
  });
});

describe("summaryDetail", () => {
  it("reads the tempo and the key as the text writes it", () => {
    expect(summaryDetail({ bpm: 121, key: { tonic: 3, scale: "major" } })).toBe("121 BPM · eb major");
    expect(summaryDetail({ bpm: 122.5, key: { tonic: 2, scale: "minor" } })).toBe("122.5 BPM · d minor");
  });
});

describe("the Blank card", () => {
  it("comes first, outside the styles, with No tracks, and selected it turns play into Start from scratch", () => {
    const model = templatePickerModel(CATALOG, { template: "blank", openStyle: null });
    expect(model.blank).toEqual({ template: "blank", name: "Blank", detail: "No tracks · 124 BPM · a minor", isSelected: true });
    expect(model.styles.map((style) => style.id)).not.toContain("");
    expect(idlePlayLabels(true)).toEqual({ label: "Start from scratch", hint: "Opens an empty project. Pick your first sound." });
    expect(idlePlayLabels(false).label).toBe("Tap to play");
  });
});
