// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pt-BR translation of strings.ts. Command names, usages and examples are the language
// the terminal reads (add, set, tempo <bpm>…) and stay in English, as do instrument,
// parameter, scale, track and section names. "Range" of a signal is "intervalo", never
// "faixa", which is a track here. pnpm i18n:check fails when a key of the source has no
// entry here.
import { defineTranslation, type Formatters } from "@untzel/i18n";
import type { InstrumentGroup, InstrumentKind } from "@untzel/core";
import { MAX_TEMPO, MIN_TEMPO } from "@untzel/language/limits";
import type { assistStrings, commandSummaries, explainStrings, strings } from "./strings";

const TEMPO_RANGE = `${MIN_TEMPO} a ${MAX_TEMPO}`;

const GROUPS: Readonly<Record<InstrumentGroup, string>> = {
  drums: "Bateria",
  bass: "Baixo",
  keys: "Teclas",
  plucks: "Plucks",
  pads: "Pads",
  brass: "Metais",
  leads: "Leads",
  voices: "Vozes",
  fx: "FX",
};

const PLAYS: Readonly<Record<InstrumentKind, string>> = { drum: "toca batidas", pitched: "toca notas", chord: "toca acordes e notas" };

function bars(f: Formatters, count: number): string {
  return f.plural(count, { one: "# compasso", other: "# compassos" });
}

/** "ou": "8 ou 16". */
function either(f: Formatters, items: readonly number[]): string {
  const printed = items.map((item) => f.number(item));
  return printed.length <= 1 ? printed.join("") : `${printed.slice(0, -1).join(", ")} ou ${printed.at(-1) ?? ""}`;
}

// Over 40 lines: a translation catalog, one entry per key of the English one; it grows with the copy, not with logic.
export const stringsPtBr = defineTranslation<typeof strings>("pt-BR", (f) => {
  const n = (value: number): string => f.number(value);
  return {
    unknownCommand: (word) => `Comando desconhecido "${word}".`,
    unknownTrack: (word) => `Nenhuma faixa se chama "${word}".`,
    unknownInstrument: (word) => `Nenhum instrumento se chama "${word}".`,
    unknownSection: (word) => `Nenhuma seção se chama "${word}".`,
    unknownParameter: (track, word) => `"${track}" não tem o parâmetro "${word}".`,
    parametersOf: (track, names) => `${track} tem ${names.join(", ")}.`,
    unknownScale: (word) => `Nenhuma escala se chama "${word}".`,
    invalidTonic: (word) => `"${word}" não é uma tônica: use uma letra de a a g, com b ou #.`,
    invalidName: (word) => `"${word}" não pode ser nome: comece com uma letra, depois letras, dígitos, - ou _.`,
    nameTaken: (word) => `Já existe uma faixa chamada "${word}".`,
    reservedName: (word) => `"${word}" é uma palavra da linguagem; escolha outro nome.`,
    between: (what, min, max) => `${what} precisa estar entre ${n(min)} e ${n(max)}.`,
    wholeBetween: (what, min, max) => `${what} precisa ser um número inteiro de ${n(min)} a ${n(max)}.`,
    oneOf: (what, choices) => `${what} precisa ser ${choices.join(", ")}.`,
    needs: (what, example) => `${what}, por exemplo ${example}.`,
    tooMany: (usage) => `Palavras demais. Uso: ${usage}`,
    notANumber: (word) => `"${word}" não é um número.`,
    signalNeedsRange: (signal, range) => `${signal} precisa de um intervalo, por exemplo ${range}.`,
    numberOnly: (name) => `${name} aceita um número, não um sinal.`,
    flagTakesNoValue: (name) => `${name} não recebe valor.`,
    invalidValue: (value, name) => `"${value}" não é um valor de ${name}.`,
    stepsRefused: (track, count) => `Os compassos de ${track} não se dividem em ${n(count)} passos; edite no código.`,
    editRefused: "Essa edição não dá para fazer aqui; tente no código.",
    sectionWouldBeEmpty: "Isso deixaria uma seção sem faixas; mude a seção antes.",
    nameTakenShort: "Esse nome já existe.",
    noProgram: "Ainda não há nada carregado: corrija o código primeiro.",
    nothingToFix: "Nada para corrigir: cada erro que sobrou pede uma escolha no código.",
    noChange: "Nada para mudar: já está assim.",
    lineTooLong: (limit) => `Um comando tem no máximo ${n(limit)} caracteres.`,
    needsTrack: (command) => `${command} precisa de uma faixa`,
    addNeedsInstrument: "add precisa de um instrumento",
    renameNeedsName: "rename precisa do nome novo",
    explainNeedsTarget: "explain precisa de um número de linha ou de uma faixa",
    tempoNeedsBpm: "tempo precisa de um BPM",
    keyNeedsTonic: "key precisa de uma tônica e de uma escala",
    keyNeedsScale: "key precisa de uma escala",
    loopNeedsBars: "loop precisa de um número de compassos",
    setNeedsParameter: "set precisa de um parâmetro",
    toneNeedsValue: "tone precisa de um valor",
    stepsNeedsCount: "steps precisa de 8, 16 ou 32",
    barsNeedsCount: "bars precisa de um número de compassos",
    sectionNeedsName: "section precisa de um nome e das faixas",
    sectionNeedsTracks: "section precisa das faixas",
    songNeedsParts: "song precisa de partes como intro 8, separadas por vírgula",
    parameterNeedsValue: (name) => `${name} precisa de um valor`,
    barsOfPart: (section) => `os compassos de ${section}`,
    added: (name, line) => `Faixa ${name} criada na linha ${n(line)}.`,
    removed: (name) => `Faixa ${name} apagada.`,
    duplicated: (from, to, line) => `${from} copiada como ${to} na linha ${n(line)}.`,
    renamed: (from, to) => `${from} agora se chama ${to}.`,
    muted: (name) => `Faixa ${name} desligada.`,
    unmuted: (name) => `Faixa ${name} ligada.`,
    tempo: (bpm) => `Tempo ${bpm} BPM.`,
    key: (tonic, scale) => `Tom ${tonic} ${scale}.`,
    loop: (count) => `Loop de ${bars(f, count)}.`,
    parameter: (track, name, value) => `${track}: ${name} ${value}.`,
    flag: (track, name) => `${track}: ${name}.`,
    steps: (track, count) => `${track}: ${n(count)} passos por compasso.`,
    bars: (track, count) => `${track}: ${bars(f, count)}.`,
    section: (name, tracks) => `Seção ${name}: ${tracks.join(" ")}.`,
    song: (parts) => `Song: ${parts}.`,
    fixed: (count) => f.plural(count, { one: "# problema corrigido.", other: "# problemas corrigidos." }),
    helpIntro: "Comandos. Digite help <comando> para ver um deles.",
    helpExample: (example) => `Por exemplo: ${example}`,
  };
});

export const commandSummariesPtBr = defineTranslation<typeof commandSummaries>("pt-BR", () => ({
  help: "lista os comandos, ou explica um",
  add: "uma faixa nova",
  duplicate: "copia uma faixa com o próximo nome livre",
  remove: "apaga uma faixa e o nome dela nas seções",
  rename: "renomeia uma faixa e as seções que a usam",
  mute: "desliga uma faixa no próximo compasso",
  unmute: "liga uma faixa no próximo compasso",
  solo: "ouve uma faixa sozinha; de novo para soltar",
  tempo: TEMPO_RANGE,
  key: "o tom em que as notas se encaixam",
  loop: "compassos de uma volta no modo loop, 1 a 16",
  set: "um número, ou um sinal com o intervalo",
  tone: "o tone da faixa, 0 a 1",
  steps: "passos por compasso",
  bars: "compassos do padrão, 1 a 16",
  section: "cria uma seção ou muda as faixas dela",
  song: "escreve a música",
  play: "começa a música",
  stop: "para a música",
  drop: "liga todas as faixas, no modo loop",
  fix: "aplica todas as correções seguras",
  explain: "o que uma linha ou uma faixa faz, em palavras simples",
  undo: "desfaz a última mudança",
  redo: "refaz o que foi desfeito",
  clear: "limpa os resultados",
}));

export const assistStringsPtBr = defineTranslation<typeof assistStrings>("pt-BR", (f) => ({
  tonic: "tônica",
  scale: "escala",
  note: "nota",
  rest: "pausa",
  hold: "sustenta",
  chord: "acorde",
  track: "faixa",
  section: "seção",
  bars: "compassos",
  steps: "passos",
  hits: "batidas: x batida, X acento, . pausa",
  tempoRange: TEMPO_RANGE,
  sectionGain: "0 a 1",
  signalOver: (shape) => `sinal ${shape} em 8 compassos`,
  flag: "uma chave, sem valor",
  choice: (choices, example) => `${choices.join(", ")}, por exemplo ${example}`,
  range: (min, max, unit, integer, fallback) =>
    `${min} a ${max}${unit === "" ? "" : ` ${unit}`}${integer ? ", números inteiros" : ""}, ${fallback}`,
  byDefault: (value) => `padrão ${value}`,
  forExample: (value) => `por exemplo ${value}`,
  statementTitle: 'title "<nome>", o nome da música, até 60 caracteres',
  statementTempo: `tempo <bpm>, ${TEMPO_RANGE}`,
  statementKey: "key <tônica> <escala>",
  statementSwing: "swing <quantidade>, 0 a 0.5",
  statementLoop: "loop <compassos>, 1 a 16",
  statementSection: "section <nome> <faixas…>",
  statementSong: "song <seção compassos, …>",
  hoverParameter: (name, instrument) => `${name} · ${instrument === null ? "modificador geral" : `parâmetro de ${instrument}`}`,
  curve: (curve) => (curve === "exponential" ? "exponencial" : "linear"),
  hoverSignalTitle: (shape) => `${shape}(<compassos>) · sinal`,
  hoverSignalBody: (shape) => `forma ${shape} ao longo de <compassos> compassos, entre os dois valores do intervalo que vem depois`,
  hoverInstrumentTitle: (name) => `${name} · instrumento`,
  hoverInstrumentKind: (group, kind) => `${GROUPS[group]} · ${PLAYS[kind]}`,
  hoverPresetTitle: (sound, instrument) => `${sound} · som de ${instrument}`,
  hoverInstrumentParameters: (parameters) =>
    parameters.length === 0 ? "sem parâmetros próprios" : `parâmetros: ${f.list(parameters)}`,
  hoverStatementTitle: (word) => `${word} · instrução`,
}));

// Over 40 lines: a translation catalog, one entry per key of the English one; it grows with the copy, not with logic.
export const explainStringsPtBr = defineTranslation<typeof explainStrings>("pt-BR", (f) => {
  const n = (value: number): string => f.number(value);
  const sounds = (count: number, what: string): string => {
    if (what === "drum") return f.plural(count, { one: "# batida", other: "# batidas" });
    if (what === "chord") return f.plural(count, { one: "# acorde", other: "# acordes" });
    return f.plural(count, { one: "# nota", other: "# notas" });
  };
  return {
    track: (name, instrument, kind) => `${name} é uma faixa de ${instrument}${kind === null ? "" : ` (${kind})`}.`,
    pattern: (count, steps, total, what) =>
      `O padrão tem ${bars(f, count)} de ${either(f, steps)} passos, com ${sounds(total, what)} ao todo.`,
    sound: (described) => `Som: ${described.join("; ")}.`,
    moves: (name, shape, period, low, high, unit) => `${name} se move com ${shape} em ${bars(f, period)}, de ${low} a ${high}${unit}`,
    shapeSine: "uma senoide",
    shapeTri: "um triângulo",
    shapeSaw: "um dente de serra",
    shapeSquare: "uma onda quadrada",
    shapeRand: "um passo aleatório",
    muted: "Está desligada (mute): entra no drop ou no unmute.",
    free: "Ignora o tom (free).",
    noSection: "Nenhuma seção usa esta faixa, então ela só toca no modo loop.",
    sections: (names) => `Toca em ${f.list(names)}.`,
    tempo: (bpm, seconds) =>
      `Tempo ${n(bpm)}: ${n(bpm)} batidas por minuto, então um compasso de quatro tempos dura ${n(Number(seconds))} segundos.`,
    keyChromatic: (tonic) => `Tom ${tonic} chromatic: as notas tocam como escritas, nada se encaixa.`,
    key: (tonic, scale) => `Tom ${tonic} ${scale}: as notas das faixas com altura se encaixam nesta escala.`,
    swing: (value) => `Swing ${value}: cada segundo passo toca um pouco atrasado, para um groove mais solto.`,
    loop: (count) => `O modo loop toca voltas de ${bars(f, count)}; cada padrão recomeça a cada volta.`,
    section: (name, tracks, tempo, gain) =>
      `A seção ${name} toca ${f.list(tracks)}${tempo === null ? "" : ` a ${n(tempo)} BPM`}${gain === 1 ? "" : ` com gain ${n(gain)}`}.`,
    songPart: (section, count) => `${section} por ${bars(f, count)}`,
    song: (parts, total, loops) =>
      `A música toca ${f.list(parts)}: ${bars(f, total)} ao todo, e então ${loops ? "recomeça" : "para"}.`,
    line: (number, text) => `Linha ${n(number)}: ${text}`,
    empty: (number) => `A linha ${n(number)} está vazia.`,
    comment: (number) => `A linha ${n(number)} é um comentário: anotação para gente, nunca soa.`,
    hasErrors: (number) =>
      `A linha ${n(number)} não dá para explicar enquanto o código tem erros; a última versão válida continua tocando.`,
    tryFix: "Digite fix para corrigir o que é seguro.",
    noTarget: (word) => `Nenhuma faixa ou seção se chama "${word}".`,
    noLine: (number, lines) => `Não existe a linha ${n(number)}; o código tem ${n(lines)}.`,
  };
});
