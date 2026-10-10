// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { bindCatalog, createTranslator, type Catalog } from "@untzel/i18n";
import { describe, expect, it } from "vitest";
import { registryWith } from "@untzel/instrument-index/testing";
import { analyze } from "../read/analyze";
import type { Diagnostic } from "../diagnostics/diagnostics";
import { englishMessages } from "./messages";
import ptBrMessages from "./messages.pt-BR";

const registry = registryWith(["kick", "hat", "bass"]);

function firstDiagnostic(source: string): Diagnostic {
  const result = analyze(source, registry);
  const found = result.ok ? result.warnings[0] : result.diagnostics[0];
  if (found === undefined) throw new Error(`expected a diagnostic for ${source}`);
  return found;
}

/** What a view shows: the live catalog entry applied to the diagnostic's arguments. */
function shown(diagnostic: Diagnostic, live: Catalog): string {
  const entry = live[diagnostic.messageKey];
  return typeof entry === "string" ? entry : (entry as (...args: unknown[]) => string)(...diagnostic.messageArgs);
}

describe("diagnostic messages as references", () => {
  it("carry the English text, the key and arguments that rebuild it", () => {
    const diagnostic = firstDiagnostic("tempo 320\nkick x...");
    expect(diagnostic.messageKey).toBe("between");
    expect(diagnostic.messageArgs).toEqual(["tempo", 40, 300]);
    expect(englishMessages.between("tempo", 40, 300)).toBe(diagnostic.message);
  });

  it("survive a structured clone, as across postMessage", () => {
    const diagnostic = firstDiagnostic("bass Cm7");
    expect(structuredClone(diagnostic)).toEqual(diagnostic);
    expect(diagnostic.messageArgs).toEqual(["bass", ["notes"], "chords"]);
  });

  it("read in the translator's language, English again after switching back", () => {
    const translator = createTranslator("en");
    const live = bindCatalog(translator, englishMessages, [ptBrMessages]);
    const diagnostic = firstDiagnostic("kick x...\nsection a kick snare");
    expect(shown(diagnostic, live)).toBe('Section "a" uses "snare", but no track has that name.');
    translator.setLocale("pt-BR");
    expect(shown(diagnostic, live)).toBe('A seção "a" usa "snare", mas nenhuma faixa tem esse nome.');
    translator.setLocale("en");
    expect(shown(diagnostic, live)).toBe(diagnostic.message);
  });

  it("name every kind of content in pt-BR, never an English word inside an argument", () => {
    const live = bindCatalog(createTranslator("pt-BR"), englishMessages, [ptBrMessages]);
    expect(shown(firstDiagnostic("bass Cm7"), live)).toBe('"bass" toca notas, não acordes.');
    expect(shown(firstDiagnostic("kick c2"), live)).toBe('"kick" toca batidas, não notas.');
  });

  it("format numbers in the reader's locale", () => {
    const live = bindCatalog(createTranslator("pt-BR"), englishMessages, [ptBrMessages]);
    expect(shown(firstDiagnostic(`kick x...\n${" ".repeat(70_000)}`), live)).toBe("Uma música pode ter no máximo 65.536 caracteres.");
  });

  it("read every Did you mean of the wave in pt-BR, with the suggestion as written", () => {
    const live = bindCatalog(createTranslator("pt-BR"), englishMessages, [ptBrMessages]);
    expect(shown(firstDiagnostic("temp 132\nkick x..."), live)).toBe('Instrução desconhecida "temp". Você quis dizer "tempo"?');
    expect(shown(firstDiagnostic("b: bass C2"), live)).toBe('"C2" não é uma nota. Você quis dizer "c2"?');
    expect(shown(firstDiagnostic("b: bass c2 | cutoff sin(8) 40..800"), live)).toBe('Sinal desconhecido "sin". Você quis dizer "sine"?');
    expect(shown(firstDiagnostic("kick x... | reverb hal"), live)).toBe(
      'reverb precisa ser small, wide, sea, room, plate, hall, dub ou um número entre 0 e 1. Você quis dizer "hall"?',
    );
    expect(shown(firstDiagnostic("kick x... | swing sine(4) 0..0.5"), live)).toBe("swing recebe um número, não um sinal.");
    expect(shown(firstDiagnostic("// nothing yet"), live)).toBe("Nada para tocar: acrescente uma faixa.");
    expect(live.unknownChoice("wave", ["saw", "square"], "square")).toBe('"wave" pode ser saw ou square. Você quis dizer "square"?');
    expect(live.fixChangeEvery("kick", "kik")).toBe("Trocar todo kick por kik");
  });

  it("translate every message", () => {
    const translation = ptBrMessages.build(createTranslator("pt-BR").formatters());
    expect(Object.keys(translation).sort()).toEqual(Object.keys(englishMessages).sort());
  });
});
