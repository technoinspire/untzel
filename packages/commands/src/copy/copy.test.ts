// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createTranslator } from "@untzel/i18n";
import { afterEach, describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { commandNamed } from "../reading/catalog";
import { addCommandsTranslations, installCommandsTranslator } from "./copy";
import { commandsPortuguese } from "./portuguese";
import { composerOf, ONBOARD } from "../testing/composer";

// The command layer answers in the installed language; the commands, their usages and
// the names in the text stay as written.

const composer = composerOf(registryWith(["kick", "hat", "bass"]));
addCommandsTranslations(commandsPortuguese);

describe("the command layer in the current language", () => {
  afterEach(() => installCommandsTranslator(createTranslator("en")));

  it("results, errors and summaries follow a language change, commands do not", () => {
    const translator = createTranslator("en");
    installCommandsTranslator(translator);
    const english = composer.run("tempo 124", ONBOARD);
    expect(english.kind === "edit" && english.proposal.summary).toBe("Tempo 124 BPM.");
    expect(commandNamed("mute")?.summary).toBe("turn a track off on the next bar");

    translator.setLocale("pt-BR");
    const removed = composer.run("remove hat", ONBOARD);
    expect(removed.kind === "edit" && removed.proposal.summary).toBe("Faixa hat apagada.");
    expect(composer.run("mute kik", ONBOARD)).toMatchObject({ kind: "error", message: 'Nenhuma faixa se chama "kik".', suggestion: "mute kick" });
    expect(commandNamed("mute")?.summary).toBe("desliga uma faixa no próximo compasso");
    expect(commandNamed("mute")?.usage).toBe("mute <track>");
  });

  it("explain and help read in pt-BR, with the usage in the language's own words", () => {
    installCommandsTranslator(createTranslator("pt-BR"));
    const explained = composer.run("explain 2", ONBOARD);
    expect(explained).toMatchObject({ kind: "info" });
    expect(explained.kind === "info" && explained.lines[0]?.text).toMatch(/^Tempo 132: 132 batidas por minuto/);
    const help = composer.run("help tempo", ONBOARD);
    expect(help.kind === "info" && help.lines.map((line) => line.text)).toEqual(["tempo <bpm>", "40 a 300", "Por exemplo: tempo 124"]);
  });
});
