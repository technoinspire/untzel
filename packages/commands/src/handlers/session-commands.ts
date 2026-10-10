// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { suggest } from "@untzel/language";
import { COMMAND_NAMES, COMMANDS, commandNamed } from "../reading/catalog";
import type { CommandContext } from "../reading/context";
import { applySafeFixes } from "../proposal/fix-all";
import { error, info, type CommandOutcome, type SessionAction } from "../proposal/outcome";
import { strings } from "../copy/copy";

// help, fix, clear and the transport and history commands, which go to the session's
// use cases instead of the text.

export function action(context: CommandContext, kind: Exclude<SessionAction["kind"], "solo">): CommandOutcome {
  const limit = context.noMoreThan(0);
  if (!limit.ok) return limit.outcome;
  return { kind: "action", action: { kind } };
}

export function clear(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(0);
  return limit.ok ? { kind: "clear" } : limit.outcome;
}

export function fix(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(0);
  if (!limit.ok) return limit.outcome;
  const fixed = applySafeFixes(context.source, context.analyze);
  if (fixed.count === 0) return info(strings.nothingToFix);
  return context.propose(
    { ok: true, source: fixed.source, changes: [] },
    { title: context.line, summary: strings.fixed(fixed.count), destructive: false },
  );
}

export function help(context: CommandContext): CommandOutcome {
  const limit = context.noMoreThan(1);
  if (!limit.ok) return limit.outcome;
  const word = context.args[0];
  if (word === undefined) {
    return info(strings.helpIntro, ...COMMANDS.map((command) => ({ text: `${command.usage}  ${command.summary}`, code: true })));
  }
  const command = commandNamed(word.text.toLowerCase());
  if (command === undefined) {
    const near = suggest(word.text.toLowerCase(), COMMAND_NAMES);
    return error(strings.unknownCommand(word.text), near === null ? null : context.suggestLine(word, near));
  }
  return info({ text: command.usage, code: true }, command.summary, strings.helpExample(command.example));
}
