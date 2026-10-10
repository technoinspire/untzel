// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { createTranslator } from "@untzel/i18n";
import { afterEach, describe, expect, it } from "vitest";
import { addControlsTranslations, groupLabels, installTranslator, strings, text } from "./copy";
import { controlsPortuguese } from "./portuguese";
import { barsLabel, loopLengthLabel, stepName, trackCountLabel } from "../behavior/text/format";
import { remixTitle } from "../behavior/text/song-title-model";

const translator = createTranslator("en");
installTranslator(translator);
addControlsTranslations(controlsPortuguese);

afterEach(() => translator.setLocale("en"));

describe("the live copy of the controls", () => {
  it("is English until the language changes, then follows it on every read", () => {
    const play = text.play;
    expect(strings.tapToPlay).toBe("Tap to play");
    expect(play()).toBe("Play");
    translator.setLocale("pt-BR");
    expect(strings.tapToPlay).toBe("Toque para tocar");
    expect(play()).toBe("Tocar");
    expect(groupLabels.drums).toBe("Bateria");
  });

  it("formats labels with the locale's plurals and words", () => {
    expect(barsLabel(1)).toBe("1 bar");
    expect(loopLengthLabel(8)).toBe("Loop length 8 bars");
    expect(trackCountLabel(5, 2, true)).toBe("5 tracks · scroll for 2 more");
    translator.setLocale("pt-BR");
    expect(barsLabel(1)).toBe("1 compasso");
    expect(loopLengthLabel(8)).toBe("Duração do loop 8 compassos");
    expect(trackCountLabel(1, 0, true)).toBe("1 faixa");
    expect(stepName(2, { kind: "rest", label: null } as never)).toBe("Passo 3, pausa");
  });
  it("a remix never stacks a prefix, in either language", () => {
    // Already a remix in another language: it keeps its one prefix.
    expect(remixTitle("Remix de Noite")).toBe("Remix de Noite");
    translator.setLocale("pt-BR");
    expect(remixTitle("Midnight Coast")).toBe("Remix de Midnight Coast");
    expect(remixTitle("Remix of Midnight Coast")).toBe("Remix of Midnight Coast");
    expect(remixTitle(null)).toBe("Remix de Sem título");
  });
});
