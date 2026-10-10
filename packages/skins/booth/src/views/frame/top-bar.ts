// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { button, element, setAttributes, setText } from "../dom";
import { icon } from "../icons";
import type { AppPhase, SaveState, UntzelView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { createAttributionLogo } from "./attribution";
import { createMenuButton, type MenuButton } from "../menu/menu-button";
import { createSongTitle, type SongTitle } from "./song-title";
export interface TopBarOptions {
  /** brand/untzel/untzel-wordmark-dark.svg, the Graphic Image: drawn, never set in a font (brand/README.md). */
  readonly wordmarkUrl: string;
  readonly menuId: string;
  readonly onExport: () => void;
  readonly onMenu: (via: "pointer" | "keyboard-first" | "keyboard-last") => void;
  readonly onRename: (title: string) => void;
  readonly announce: (message: string) => void;
}
export interface TopBar {
  readonly root: HTMLElement;
  readonly menuButton: MenuButton;
  readonly title: SongTitle;
  update(view: UntzelView, isMenuOpen: boolean): void;
}
/**
 * Export acts on the running session: before the first play (and on the loading and
 * failure screens) it shows inert instead of looking active and doing nothing.
 */
export function areSessionActionsAvailable(phase: AppPhase): boolean {
  return phase === "running";
}
/** "Saved" next to the title on the desktop; nothing before the first save. */
export function saveStateLabel(state: SaveState | null): string {
  if (state === "saved") return strings.saved;
  if (state === "saving") return strings.saving;
  return state === "blocked" ? strings.savingBlocked : "";
}
/**
 * The Untzel wordmark (linked to the Attribution URL), divider, the song title in the only
 * h1 (a hidden "Untzel" with no project), then Saved, Export and Menu.
 * The Attribution Phrase lives in the shell's footer.
 */
// Over 40 lines: one bar built and updated, nothing else.
export function createTopBar(options: TopBarOptions): TopBar {
  const logo = createAttributionLogo(options.wordmarkUrl);
  const bar = element("header", { className: "ui-topbar" });
  const title = createSongTitle({
    id: "ui-song-title",
    onRename: options.onRename,
    announce: options.announce,
    onEditing: (isEditing) => (bar.dataset["renaming"] = String(isEditing)),
  });
  const saved = element("p", { className: "ui-topbar__saved" }, [icon("check"), element("span")]);
  // Hidden, not only visually: aria-describedby reads it, browse mode never meets it as
  // loose text in the banner.
  const reason = element("span", { text: text.pressPlayFirst, attributes: { id: "ui-export-inert", hidden: true } });
  const exporter = button("ui-topbar__action ui-topbar__action--export", text.export, () => {
    if (exporter.getAttribute("aria-disabled") === "true") options.announce(strings.pressPlayFirst);
    else options.onExport();
  }, [icon("export"), element("span", { className: "ui-topbar__label", text: text.export })]);
  // The visible label names the button on desktop; on mobile it is visually hidden.
  exporter.removeAttribute("aria-label");
  const menuButton = createMenuButton(options.menuId, options.onMenu);
  const actions = element("div", { className: "ui-topbar__actions" }, [exporter, menuButton.root, reason]);
  const divider = element("span", { className: "ui-topbar__divider", attributes: { "aria-hidden": "true" } });
  const brand = element("div", { className: "ui-topbar__brand" }, [logo, divider, title.root, saved]);
  bar.append(brand, actions);
  bar.dataset["renaming"] = "false";
  return {
    root: bar,
    menuButton,
    title,
    update(view, isMenuOpen) {
      const isInert = !areSessionActionsAvailable(view.phase);
      setAttributes(exporter, { "aria-disabled": isInert ? "true" : null, "aria-describedby": isInert ? "ui-export-inert" : null });
      title.update(view.project.title);
      // With no project the wordmark alone names the app: no divider before an empty title.
      divider.hidden = view.project.title === null;
      const label = view.project.title === null ? "" : saveStateLabel(view.project.saveState);
      setText(saved.lastElementChild ?? saved, label);
      saved.hidden = label === "";
      saved.dataset["state"] = view.project.saveState ?? "none";
      menuButton.update(isMenuOpen);
    },
  };
}
