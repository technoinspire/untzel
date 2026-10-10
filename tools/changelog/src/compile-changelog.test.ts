// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import type { ChangeEntry } from "./change-entry";
import { compileChangelog, pullRequestOf, serializeChangelog } from "./compile-changelog";

const entry = (title: string, extra: Partial<ChangeEntry> = {}): ChangeEntry => ({
  category: "fixed",
  title: { en: title, "pt-BR": title },
  body: { en: "b", "pt-BR": "b" },
  ...extra,
});

describe("compileChangelog", () => {
  it("fills the day and pull request from the squash commit that added the file", () => {
    const changelog = compileChangelog(
      [{ path: "changelog/entries/x.json", entry: entry("x"), origin: { date: "2026-10-06", subject: "fix: no cut (#40)" } }],
      "technoinspire/untzel",
      "2026-10-07",
    );
    expect(changelog.entries[0]).toMatchObject({ date: "2026-10-06", refs: [40] });
    expect(changelog.source).toEqual({ repository: "technoinspire/untzel", throughPullRequest: 40 });
  });

  it("keeps what the file sets, and dates an uncommitted file today", () => {
    const changelog = compileChangelog(
      [
        { path: "b.json", entry: entry("set", { date: "2026-10-03", refs: [1, 2] }), origin: { date: "2026-10-06", subject: "x (#9)" } },
        { path: "a.json", entry: entry("new"), origin: null },
      ],
      "r",
      "2026-10-07",
    );
    expect(changelog.entries.map((item) => [item.date, item.refs])).toEqual([
      ["2026-10-03", [1, 2]],
      ["2026-10-07", []],
    ]);
  });

  it("orders by day, then by file, and serializes with a final newline", () => {
    const changelog = compileChangelog(
      [
        { path: "b.json", entry: entry("b", { date: "2026-10-04" }), origin: null },
        { path: "a.json", entry: entry("a", { date: "2026-10-04" }), origin: null },
        { path: "c.json", entry: entry("c", { date: "2026-10-03" }), origin: null },
      ],
      "r",
      "2026-10-07",
    );
    expect(changelog.entries.map((item) => item.title.en)).toEqual(["c", "a", "b"]);
    expect(serializeChangelog(changelog).endsWith("}\n")).toBe(true);
  });

  it("reads the pull request of a squash subject only", () => {
    expect(pullRequestOf("feat: x (#33)")).toBe(33);
    expect(pullRequestOf("feat: x #33")).toBeNull();
  });
});
