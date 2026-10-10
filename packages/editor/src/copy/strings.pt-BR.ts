// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// pt-BR translation of strings.ts. "Code" and "Drop" stay as the controls name them; the
// commands the terminal reads (help, solo, drop…) are the language and stay in English.
// Short labels are measured at 390 px in pt-BR (apps/web/tests/skins/booth/parallel/page/i18n.browser.ts).
// pnpm i18n:check fails when a key of the source has no entry here.
import { defineTranslation } from "@untzel/i18n";
import type { strings } from "./strings";

// Over 40 lines: a translation catalog, one entry per key of the English one; it grows with the copy, not with logic.
export default defineTranslation<typeof strings>("pt-BR", (f) => ({
  sourceLabel: "Código Untzel",
  keepsPlaying: "A versão anterior continua tocando.",
  fixesFor: (message) => `Correções para: ${message}`,
  ignore: "Ignorar",
  problemAt: (line, message) => `Linha ${f.number(line)}: ${message} A versão anterior continua tocando.`,
  noFixHere: "Nenhuma correção aqui.",
  tabLeaves: "Tab sai do editor. Esc de novo fecha o Code.",
  escThenTab: "Esc e depois Tab saem do editor.",
  commands: "Comandos",
  resize: "Redimensionar os comandos",
  terminalHint: "Tab completa · Alt+↓ próxima sugestão · ↑ e ↓ para o histórico",
  commandLabel: "Comando",
  placeholder: "Digite um comando",
  run: "Rodar",
  suggestions: "Sugestões",
  results: "Resultados",
  emptyTitle: "Digite um comando, ou help para ver a lista.",
  emptyKeys: "Tab completa · ↑ e ↓ percorrem o histórico.",
  emptyChoose: "Alt+↓: próxima sugestão · Shift+Tab sai.",
  emptyBar: "As mudanças tocam no próximo compasso.",
  didYouMean: "Você quis dizer",
  onNextBar: "no próximo compasso",
  applied: "aplicado",
  playingSince: (bar) => `tocando desde o compasso ${f.number(bar)}`,
  previewTitle: (title, lines) => `Prévia · ${title} · ${f.plural(lines, { one: "# linha", other: "# linhas" })}`,
  previewNote: "Nada muda até você aplicar. A música continua tocando.",
  previewAgain: "O código mudou enquanto isso: aqui está a prévia de novo.",
  apply: "Aplicar",
  cancel: "Cancelar",
  cancelled: "Cancelado. Nada mudou.",
  diffAdded: "acrescentada",
  diffRemoved: "removida",
  playing: "Tocando.",
  stopped: "Parado.",
  dropped: "Drop: todas as faixas ligadas, no próximo compasso.",
  undone: "Desfeito.",
  redone: "Refeito.",
  solo: (track) => `Solo em ${track}. Digite solo ${track} de novo para soltar.`,
  soloReleased: (track) => `${track} saiu do solo.`,
  failureNoProgram: "Ainda não há nada carregado: corrija o código primeiro.",
  failureNotInLoop: "drop funciona no modo loop.",
  failureNothingToUndo: "Nada para desfazer.",
  failureNothingToRedo: "Nada para refazer.",
  failureSongUnavailable: "Não há música para tocar: escreva uma seção primeiro.",
  failureUnknownTrack: "Essa faixa não existe mais.",
  failed: "Não deu certo; a música continua tocando.",
}));
