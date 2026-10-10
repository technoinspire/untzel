// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { element } from "../dom";
import { strings, text } from "../../copy/copy";
import { createSheet, type Sheet } from "../sheets/sheet";
// Help → Keyboard shortcuts: every key of shortcuts.ts with what it does,
// as a table (keys | action). Mod is ⌘ on a Mac and Ctrl elsewhere.
export interface ShortcutRow {
  readonly keys: string;
  readonly action: string;
}
export function shortcutRows(isMac: boolean): readonly ShortcutRow[] {
  const mod = isMac ? "⌘" : "Ctrl+";
  return [
    { keys: "Space", action: strings.shortcutPlay },
    { keys: "1–9", action: strings.shortcutTracks },
    { keys: "A", action: strings.shortcutAdd },
    { keys: "D", action: strings.shortcutDrop },
    { keys: "[ ]", action: strings.shortcutLoop },
    { keys: "H", action: strings.shortcutHide },
    { keys: `${mod}Z`, action: strings.shortcutUndo },
    { keys: `${mod}Shift+Z`, action: strings.shortcutRedo },
    { keys: `${mod}Enter`, action: strings.shortcutApply },
    { keys: `${mod}.`, action: strings.shortcutStop },
    { keys: `${mod}S`, action: strings.shortcutSave },
    { keys: "Esc", action: strings.shortcutClose },
  ];
}
export function createShortcutsSheet(isMac: boolean, onClose: () => void): Sheet {
  const sheet = createSheet({ id: "ui-shortcuts", title: text.keyboardShortcuts, className: "ui-sheet--shortcuts", onClose });
  const head = element("thead", {}, [
    element("tr", {}, [
      element("th", { text: text.shortcutKeys, attributes: { scope: "col" } }),
      element("th", { text: text.shortcutAction, attributes: { scope: "col" } }),
    ]),
  ]);
  const rows = shortcutRows(isMac).map((row) =>
    element("tr", {}, [element("td", {}, [element("kbd", { text: row.keys })]), element("td", { text: row.action })]),
  );
  sheet.body.append(element("table", { className: "ui-shortcuts" }, [head, element("tbody", {}, rows)]));
  return sheet;
}
