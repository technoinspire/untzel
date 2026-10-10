// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pt-BR translation of range-strings.ts: the play range and the export's stretch.
// "Trecho" is the range, as the export sheet already says it; Cycle, Loop,
// Song and Story stay as the controls name them (strings.pt-BR.ts). A beat is "tempo" and
// a step "passo", the words of a Brazilian producer; positions stay bar.beat ("3.2.3").
// pnpm i18n:check fails when a key of the source has no entry here.
import { defineTranslation } from "@untzel/i18n";
import type { exportStretchPhrases, exportStretchStrings, rangePhrases, rangeStrings } from "./range-strings";

export const rangeStringsPtBr = defineTranslation<typeof rangeStrings>("pt-BR", () => ({
  playRange: "Trecho de execução",
  rangeStart: "Início do trecho",
  rangeEnd: "Fim do trecho",
  start: "Início",
  end: "Fim",
  clearRange: "Limpar trecho",
  wholeLoop: "Loop inteiro · arraste uma alça ou toque dois compassos",
  wholeSong: "Música inteira · arraste uma alça ou toque dois compassos",
  wholeLoopValue: "loop inteiro",
  wholeSongValue: "música inteira",
  cycle: "Cycle",
  on: "Ligado",
  off: "Desligado",
  toHere: "Até aqui",
  inRange: "No trecho",
  oneBarLoop: "O loop tem 1 compasso.",
  legend: "Faixa = trecho · linha branca = tocando agora · contorno laranja = o compasso que você edita",
  listHintVisible: "começa o trecho numa parte. Até aqui estende.",
  listHintNoRange: "começa o trecho numa parte.",
  listHintAccessible: "O botão de colchetes começa o trecho numa parte. Até aqui estende.",
  listHintNoRangeAccessible: "O botão de colchetes começa o trecho numa parte.",
}));

export const rangePhrasesPtBr = defineTranslation<typeof rangePhrases>("pt-BR", (f) => {
  const n = (value: number): string => f.number(value);
  const bars = (start: number, end: number): string => (start === end ? `compasso ${n(start)}` : `compassos ${n(start)}–${n(end)}`);
  return {
    bars,
    chip: (start, end) => `Trecho: ${bars(start, end)}`,
    loopNote: (start, end) =>
      start === end ? `Repete o compasso ${n(start)}. Muda no próximo compasso.` : `Repete os compassos ${n(start)} a ${n(end)}. Muda no próximo compasso.`,
    stretch: (names, start, end) => (names === null ? bars(start, end) : `${names}, ${bars(start, end)}`),
    cycleOn: (stretch) => `Repete ${stretch}. Com o Cycle desligado, segue pelo resto da música.`,
    cycleOff: (from) => `Toca a partir de ${from} e segue pelo resto da música.`,
    barsOf: (start, end, total) => `${bars(start, end)} de ${n(total)}`,
    barNumbers: (start, end) => (start === end ? n(start) : `${n(start)}–${n(end)}`),
    fromStart: (part, bar) => (part === null ? `a partir do compasso ${n(bar)}` : `a partir de ${part}, compasso ${n(bar)}`),
    fromBar: (bar) => `a partir do compasso ${n(bar)}`,
    from: (part, bar) => (part === null ? `compasso ${n(bar)}` : `${part}, compasso ${n(bar)}`),
    pendingBar: (bar) => `Do compasso ${n(bar)}: toque o compasso final`,
    pendingPart: (part) => `De ${part}: toque a parte final`,
    handleValue: (handle, bar, lastBar, extra) => `${handle}, compasso ${n(bar)} de ${n(lastBar)}${extra === null ? "" : `, ${extra}`}`,
    handleLabel: (handle, bar) => `${handle} · compasso ${n(bar)}`,
    setRangeToPart: (part) => `Trecho em ${part}`,
    extendRangeTo: (part) => `Até aqui: estender o trecho até ${part}`,
    playPartOnly: (part) => `Tocar só ${part}`,
    playFromNoteMoves: (bar) => `Tocar daqui leva o início do trecho ao compasso ${n(bar)}, no próximo compasso.`,
    playFromNoteBars: (start, end) => `Tocar daqui toca os compassos ${n(start)} a ${n(end)}, no próximo compasso.`,
    playFromNoteSong: (bar) => `Tocar daqui toca a música a partir do compasso ${n(bar)}, no próximo compasso.`,
    exportRange: (start, end, names) => `${start === end ? `Compasso ${n(start)}` : `Compassos ${n(start)}–${n(end)}`}${names === null ? "" : ` · ${names}`}`,
  };
});

export const exportStretchStringsPtBr = defineTranslation<typeof exportStretchStrings>("pt-BR", () => ({
  ruler: "Trecho do export",
  fine: "Fino",
  fineHint: "passos de 1/64; Shift ou Alt enquanto arrasta",
  usePlayRange: "Usar o trecho de execução",
  useWholeLoop: "Usar o loop inteiro",
  useWholeSong: "Usar a música inteira",
  listen: "Ouvir",
  stopListening: "Parar",
  listenHint: "Toca o trecho do export desde o primeiro compasso",
}));

export const exportStretchPhrasesPtBr = defineTranslation<typeof exportStretchPhrases>("pt-BR", (f) => {
  const n = (value: number): string => f.number(value);
  return {
    cap: (what, limit) => `${what} até ${limit}`,
    readout: (start, startBar, end, endBar) => `${start} · compasso ${startBar} → ${end} · compasso ${endBar}`,
    dragLabel: (handle, time, barBeat) => `${handle} · ${time} · ${barBeat}`,
    handleValue: (handle, time, spoken) => `${handle}, ${time}, ${spoken}`,
    spokenPosition: (bar, beat, step, fine) =>
      `compasso ${n(bar)} tempo ${n(beat)}${step === 1 && fine === 0 ? "" : ` passo ${n(step)}`}${fine === 0 ? "" : ` e ${n(fine)}/64`}`,
  };
});
