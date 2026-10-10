// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Third-party attribution check: every source file with a comment line
// "Portions derived from" a project and its licence in brackets must be listed under the
// "## <Project>" section of THIRD_PARTY.md. Pure: the caller reads the files.

/** A comment line that starts with the attribution phrase. */
const DERIVED = /^\s*(?:\/\/!?|#|\/\*|<!--)\s*Portions derived from (.+?) \(([^)]+)\)/m;

/** The "## Project" sections of THIRD_PARTY.md, each with its text. */
export function thirdPartySections(markdown) {
  const sections = new Map();
  let current = null;
  for (const line of markdown.split("\n")) {
    const heading = /^## (.+?)\s*$/.exec(line);
    if (heading !== null) {
      current = heading[1];
      sections.set(current, "");
    } else if (current !== null) {
      sections.set(current, `${sections.get(current)}${line}\n`);
    }
  }
  return sections;
}

/** Problems of one file: none when it derives nothing or is listed under its project. */
export function attributionProblems(path, text, sections) {
  const match = DERIVED.exec(text);
  if (match === null) return [];
  const project = match[1];
  const section = sections.get(project);
  if (section === undefined) return [`${path}: derives from "${project}", which has no section in THIRD_PARTY.md`];
  if (!section.includes(path)) return [`${path}: not listed under "${project}" in THIRD_PARTY.md`];
  return [];
}
