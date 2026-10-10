// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { createTranslator } from "@untzel/i18n";
import { afterEach, describe, expect, it } from "vitest";
import { addControlsTranslations, installTranslator, readLabel } from "../../copy/copy";
import { controlsPortuguese } from "../../copy/portuguese";
import { deletedTexts, offerUndo, undoOffer, type OfferToast, type UndoOffer } from "./undo-offer";

const translator = createTranslator("en");
installTranslator(translator);
addControlsTranslations(controlsPortuguese);
afterEach(() => translator.setLocale("en"));

const read = (offer: UndoOffer) => ({ message: offer.message(), label: offer.label(), action: offer.action });

describe("undoOffer", () => {
  it("offers Undo after the delete and Redo after the undo", () => {
    expect(read(undoOffer(deletedTexts("ride"), "undo"))).toEqual({ message: "ride deleted", label: "Undo", action: "undo" });
    expect(read(undoOffer(deletedTexts("ride"), "redo"))).toEqual({ message: "ride is back", label: "Redo", action: "redo" });
  });

  // The toast re-reads its texts on a language change.
  it("reads the language of the moment, not the one it was made in", () => {
    const offer = undoOffer(deletedTexts("kick"), "undo");
    expect(read(offer)).toEqual({ message: "kick deleted", label: "Undo", action: "undo" });
    translator.setLocale("pt-BR");
    expect(read(offer)).toEqual({ message: "kick apagada", label: "Desfazer", action: "undo" });
  });
});

describe("offerUndo", () => {
  it("runs the session's undo, then redo, flipping what the toast says", () => {
    const calls: string[] = [];
    let tap: () => void = () => undefined;
    const toast: OfferToast = {
      show(message, label, onAction) {
        calls.push(`${readLabel(message)} · ${readLabel(label)}`);
        tap = onAction;
      },
    };
    offerUndo(
      toast,
      {
        undo: () => (calls.push("undo"), null),
        redo: () => (calls.push("redo"), null),
      },
      deletedTexts("ride"),
    );
    tap();
    tap();
    expect(calls).toEqual(["ride deleted · Undo", "undo", "ride is back · Redo", "redo", "ride deleted · Undo"]);
  });
});
