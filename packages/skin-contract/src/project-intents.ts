// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// What the project menu, the title in the bar and the Projects sheet ask for.
// Switching project stops the music cleanly and waits for Tap to play; renaming
// edits the `title` line and never touches the sound. A null id is the open project.
export interface ProjectIntents {
  /** The template choice: the music stops and the waiting screen offers the templates. */
  newProject(): void;
  /** The project waits on the waiting screen for Tap to play. */
  openProject(id: string): void;
  /** "Continue <title>" on the waiting screen: opens and plays, inside the tap. */
  continueProject(id: string): void;
  /** The song title in the bar or "Rename song": one undoable edit of the title line. */
  renameSong(title: string): void;
  /** A stored project's title, from the Projects sheet. */
  renameProject(id: string, title: string): void;
  /** "<title> (copy)", opened on the waiting screen. */
  duplicateProject(id: string | null): void;
  /** Gone at once; Undo brings it back for 10 s. */
  deleteProject(id: string | null): void;
  undoDeleteProject(): void;
  /** The .untzel of a stored project, named from its title. */
  saveProjectFile(id: string): void;
  /** Mod+S: the open project is saved now instead of a second after the last edit. */
  saveProjectNow(): void;
}
