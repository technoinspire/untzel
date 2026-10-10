// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { checkName } from "@untzel/language";
import { error, type CommandOutcome } from "../proposal/outcome";
import { strings } from "../copy/copy";

// The one name rule (language's checkName) said the way the command line says it.

/** Null when `name` can be written; otherwise the error the command line shows. */
export function nameError(name: string, taken: ReadonlySet<string>): CommandOutcome | null {
  switch (checkName(name, taken)) {
    case null:
      return null;
    case "INVALID_NAME":
      return error(strings.invalidName(name));
    case "RESERVED_NAME":
      return error(strings.reservedName(name));
    case "NAME_TAKEN":
      return error(strings.nameTaken(name));
  }
}
