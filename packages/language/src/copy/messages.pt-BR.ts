// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pt-BR translation of messages.ts. Keywords, instrument, parameter, scale and section
// names stay as written in the text. pnpm i18n:check fails when a key of the source has no
// entry here.
import { defineTranslation } from "@untzel/i18n";
import type { englishMessages } from "./messages";
import type { PatternContent } from "../vocabulary/pattern-content";

const CONTENT: Readonly<Record<PatternContent, string>> = { hits: "batidas", notes: "notas", chords: "acordes" };

// Over 40 lines: a translation catalog, one entry per key of the English one; it grows with the copy, not with logic.
export default defineTranslation<typeof englishMessages>("pt-BR", (f) => {
  const didYouMean = (suggestion: string | null): string => (suggestion === null ? "" : ` Você quis dizer "${suggestion}"?`);
  const n = (value: number): string => f.number(value);
  return {
    sourceTooLong: (limit) => `Uma música pode ter no máximo ${n(limit)} caracteres.`,
    internalError: () => "Algo deu errado ao ler este texto.",
    unexpected: (text) => `"${text}" inesperado.`,
    unexpectedEnd: () => "Fim de linha inesperado.",
    invalidNote: (text, suggestion = null) => `"${text}" não é uma nota.${didYouMean(suggestion)}`,
    unknownStatement: (word, suggestion) => `Instrução desconhecida "${word}".${didYouMean(suggestion)}`,
    unknownSignal: (word, suggestion) => `Sinal desconhecido "${word}".${didYouMean(suggestion)}`,
    unknownInstrument: (name, suggestion) => `Instrumento desconhecido "${name}".${didYouMean(suggestion)}`,
    duplicateTrack: (name, line) => `Já existe uma faixa chamada "${name}" na linha ${n(line)}.`,
    duplicateSection: (name, line) => `Já existe uma seção chamada "${name}" na linha ${n(line)}.`,
    unknownTrack: (section, track, suggestion = null) =>
      `A seção "${section}" usa "${track}", mas nenhuma faixa tem esse nome.${didYouMean(suggestion)}`,
    unknownSection: (section, suggestion = null) => `O song usa "${section}", mas nenhuma seção tem esse nome.${didYouMean(suggestion)}`,
    unknownModifier: (instrument, name, suggestion) => `"${instrument}" não tem o parâmetro "${name}".${didYouMean(suggestion)}`,
    unknownSectionModifier: (name, suggestion) => `Uma seção só aceita tempo, gain e loop, não "${name}".${didYouMean(suggestion)}`,
    unknownScale: (name, suggestion) => `Escala desconhecida "${name}".${didYouMean(suggestion)}`,
    between: (name, min, max) => `${name} precisa estar entre ${n(min)} e ${n(max)}.`,
    wholeBetween: (name, min, max) => `${name} precisa ser um número inteiro entre ${n(min)} e ${n(max)}.`,
    noValue: (name) => `${name} não recebe valor.`,
    noSignal: (name) => `${name} recebe um número, não um sinal.`,
    reverbValue: (suggestion = null) =>
      `reverb precisa ser small, wide, sea, room, plate, hall, dub ou um número entre ${n(0)} e ${n(1)}.${didYouMean(suggestion)}`,
    delayValue: () => "delay precisa ser 1/8, 3/16 ou 1/4.",
    signalPeriod: (max) => `O período de um sinal precisa ser maior que ${n(0)} e no máximo ${n(max)} compassos.`,
    signalNeedsRange: (signal, example) => `${signal} precisa de uma faixa, por exemplo ${example}.`,
    probability: () => `Uma probabilidade precisa estar entre ${n(0)} e ${n(1)}.`,
    repeat: (min, max) => `Uma repetição precisa ser um número inteiro de ${n(min)} a ${n(max)}.`,
    groupDepth: (max) => `Grupos podem ser aninhados no máximo ${n(max)} níveis.`,
    partBars: (min, max) => `Uma parte precisa durar de ${n(min)} a ${n(max)} compassos.`,
    missingValue: (name, example) => `${name} precisa de um valor, por exemplo ${example}.`,
    emptyPattern: () => "Esta faixa não tem passos.",
    tooManySteps: (max) => `Um compasso pode ter no máximo ${n(max)} passos.`,
    tooManyBars: (max) => `Um padrão pode ter no máximo ${n(max)} compassos.`,
    nameTooLong: (max) => `Um nome pode ter no máximo ${n(max)} caracteres.`,
    kindMismatch: (instrument, plays, found) =>
      `"${instrument}" toca ${f.list(plays.map((content) => CONTENT[content]))}, não ${CONTENT[found]}.`,
    duplicateSong: () => "Um texto só pode ter um song.",
    duplicateStatement: (name, line) => `${name} já foi definido na linha ${n(line)}.`,
    emptyTitle: () => "O título da música está vazio; fica o último título.",
    titleTooLong: (limit) => `Um título pode ter no máximo ${n(limit)} caracteres.`,
    duplicateModifier: (name) => `${name} aparece duas vezes; vale o último.`,
    globalsFirst: (name) => `${name} vem antes das faixas, das seções e do song.`,
    tracksBeforeSections: () => "As seções vêm depois das faixas.",
    sectionsBeforeSong: () => "O song vem depois das faixas e das seções.",
    envelopeSeconds: (min, max) => `env recebe um tempo de ${n(min)} a ${n(max)} segundos.`,
    slowSignalOnly: (name) => `"${name}" aceita só sinal lento; use um período de 1 compasso ou mais.`,
    fastPeriod: () => "Um sinal rápido pode ser curto até 1/64 de compasso.",
    randDivision: () => "rand abaixo de um compasso precisa de um múltiplo de 1/16, por exemplo rand(1/8).",
    unknownPreset: (instrument, sound, suggestion) => `"${instrument}" não tem o som "${sound}".${didYouMean(suggestion)}`,
    unknownChoice: (name, choices, suggestion = null) =>
      `"${name}" pode ser ${choices.slice(0, -1).join(", ")} ou ${choices[choices.length - 1] ?? ""}.${didYouMean(suggestion)}`,
    choiceNeedsName: (name) => `"${name}" recebe um nome, não um sinal.`,
    noEffectWithoutChords: (what, instrument) => `${what} precisa de um instrumento de acordes; "${instrument}" não toca acordes.`,
    noEffectWithoutArp: (what) => `${what} precisa de arp, por exemplo arp up.`,
    noEffectWithoutMono: (what, instrument, playsChords) =>
      `${what} precisa de um instrumento de uma voz só; "${instrument}" toca ${playsChords ? "acordes" : "várias vozes"}.`,
    tooManyModulators: (max) => `Uma faixa pode ter no máximo ${n(max)} sinais rápidos.`,
    duplicateLoopSection: (name, line) => `Só uma seção pode ser o loop; "${name}" já é, na linha ${n(line)}.`,
    accentNeedsHit: () => "! precisa de uma batida ou de uma nota antes.",
    stackSize: (min, max) => `Uma pilha tem de ${n(min)} a ${n(max)} notas.`,
    arpRate: (rates) => `arp-rate pode ser ${rates.join(", ")}.`,
    keywordWithSound: (word) => `"${word}" é uma instrução, não um instrumento.`,
    nothingToPlay: () => "Nada para tocar: acrescente uma faixa.",
    // Quick fix titles: short enough for a button at 390 px.
    fixChange: (to) => `Trocar por ${to}`,
    fixAddRange: (range) => `Pôr o intervalo ${range}`,
    fixAddValue: (example) => `Escrever ${example}`,
    fixRemoveEarlier: (name) => `Tirar o ${name} anterior`,
    fixRename: (name) => `Renomear para "${name}"`,
    fixChangeEvery: (from, to) => `Trocar todo ${from} por ${to}`,
  };
});
