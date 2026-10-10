// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The commands of the Code panel's command line, from the list the terminal reads
// (@untzel/commands COMMANDS): usage and example as code, the summary in the page's language.
import { COMMANDS, englishCommandSummaries } from "@untzel/commands";
import { commandSummariesPtBr } from "@untzel/commands/pt-BR";
import { translateCatalog } from "@untzel/i18n";
import { table } from "../render/components";
import { html } from "../render/html";
import { DirectiveError, markdownTable, md, type Directive } from "./types";

export const commands: Directive = (_, context) => {
  const summaries: Readonly<Record<string, string>> = translateCatalog(
    englishCommandSummaries,
    [commandSummariesPtBr],
    context.locale,
    context.formatters,
  );
  const rows = COMMANDS.map((command) => {
    const summary = summaries[command.name];
    if (summary === undefined) throw new DirectiveError(`command "${command.name}" has no summary in packages/commands/src/copy/strings.ts`);
    return [command.usage, summary, command.example] as const;
  });
  const columns = [{ label: context.text.command }, { label: context.text.commandDoes }, { label: context.text.exampleText }];
  return {
    html: table(
      columns,
      rows.map(([usage, summary, example]) => html`<tr><th scope="row"><code>${usage}</code></th><td>${summary}</td><td><code>${example}</code></td></tr>`),
    ),
    markdown: markdownTable(columns.map((column) => column.label), rows.map(([usage, summary, example]) => [md(usage), summary, md(example)])),
  };
};
