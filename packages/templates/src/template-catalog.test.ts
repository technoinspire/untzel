// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { parseStyleFile } from "./style-file";
import { discoverTemplates, templateIdOf } from "./template-catalog";

const header = (name: string, order: number, extra = ""): string => `// template: ${name}\n// order: ${order}\n${extra}tempo 124\n`;

const LIBRARY: Record<string, string> = {
  "house/style.json": '{ "label": "House", "order": 2 }',
  "house/sunday-piano.untzel": header("Sunday Piano", 1),
  "house/disco-lights.untzel": header("Disco Lights", 2),
  "melodic-techno/style.json": '{ "label": "Melodic techno", "order": 1 }',
  "melodic-techno/after-hours.untzel": header("After Hours", 3),
  "melodic-techno/midnight-bloom.untzel": header("Midnight Bloom", 1, "// default: true\n"),
  "blank.untzel": header("Start from scratch", 0),
};

describe("discoverTemplates", () => {
  it("makes a style per folder in style.json order, and its projects in header order", () => {
    const catalog = discoverTemplates(LIBRARY);
    expect(catalog.styles).toEqual([
      { id: "melodic-techno", label: "Melodic techno", order: 1 },
      { id: "house", label: "House", order: 2 },
    ]);
    expect(catalog.projects.map((project) => [project.id, project.style, project.name])).toEqual([
      ["melodic-techno/midnight-bloom", "melodic-techno", "Midnight Bloom"],
      ["melodic-techno/after-hours", "melodic-techno", "After Hours"],
      ["house/sunday-piano", "house", "Sunday Piano"],
      ["house/disco-lights", "house", "Disco Lights"],
    ]);
    expect(catalog.projects[2]?.text).toBe(LIBRARY["house/sunday-piano.untzel"]);
    expect(catalog.problems).toEqual([]);
  });

  it("keeps a template at the root out of every style tab", () => {
    const catalog = discoverTemplates(LIBRARY);
    expect(catalog.starters.map((starter) => [starter.id, starter.name, starter.order])).toEqual([["blank", "Start from scratch", 0]]);
    expect(catalog.projects.some((project) => project.id === "blank")).toBe(false);
  });

  it("plays the project marked default first, else the first project", () => {
    expect(discoverTemplates(LIBRARY).firstTouch).toBe("melodic-techno/midnight-bloom");
    const unmarked = { ...LIBRARY, "melodic-techno/midnight-bloom.untzel": header("Midnight Bloom", 1) };
    expect(discoverTemplates(unmarked).firstTouch).toBe("melodic-techno/midnight-bloom");
    expect(discoverTemplates({}).firstTouch).toBeNull();
  });

  it("reports a second default and plays the first in order", () => {
    const twice = { ...LIBRARY, "house/sunday-piano.untzel": header("Sunday Piano", 1, "// default: true\n") };
    const catalog = discoverTemplates(twice);
    expect(catalog.firstTouch).toBe("melodic-techno/midnight-bloom");
    expect(catalog.problems).toHaveLength(1);
  });

  it("leaves out, with a reason, a file without a header, a folder without style.json and a nested file", () => {
    const catalog = discoverTemplates({
      ...LIBRARY,
      "house/no-header.untzel": "tempo 120\n",
      "jungle/amen.untzel": header("Amen", 1),
      "house/old/loop.untzel": header("Loop", 1),
      "House/Upper.untzel": header("Upper", 1),
    });
    expect(catalog.projects.map((project) => project.id)).not.toEqual(expect.arrayContaining(["house/no-header", "jungle/amen", "house/old/loop"]));
    expect(catalog.styles.map((style) => style.id)).toEqual(["melodic-techno", "house"]);
    expect(catalog.problems).toHaveLength(4);
  });

  it("drops a style whose folder has no project, and reads paths with a leading ./", () => {
    const catalog = discoverTemplates({ "./empty/style.json": '{ "label": "Empty", "order": 1 }', "./house/style.json": '{ "label": "House", "order": 2 }', "./house/a.untzel": header("A", 1) });
    expect(catalog.styles.map((style) => style.id)).toEqual(["house"]);
    expect(catalog.projects.map((project) => [project.id, project.text])).toEqual([["house/a", header("A", 1)]]);
  });
});

describe("templateIdOf", () => {
  it("is the path without the extension", () => {
    expect(templateIdOf("house/disco-lights.untzel")).toBe("house/disco-lights");
    expect(templateIdOf("./blank.untzel")).toBe("blank");
  });
});

describe("parseStyleFile", () => {
  it("needs a label and an order of 1 or more", () => {
    expect(parseStyleFile('{ "label": " House ", "order": 4 }')).toEqual({ label: "House", order: 4 });
    expect(parseStyleFile('{ "label": "House" }')).toBeNull();
    expect(parseStyleFile('{ "label": "", "order": 1 }')).toBeNull();
    expect(parseStyleFile('{ "label": "House", "order": 0 }')).toBeNull();
    expect(parseStyleFile("not json")).toBeNull();
  });
});
