// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element, setAttributes, setText } from "../dom";
import { formatKey } from "../../behavior/text/format";
import type { TransportView } from "@untzel/presentation/view-model";
import { strings } from "../../copy/copy";
import { bpmText, tempoEditorModel } from "../song-settings/tempo-editor-model";

// "124 BPM · c minor" in the transport as two buttons: the tempo opens
// the tempo editor, the key the key picker. The " · " between them is no part of either.

export interface TransportTempoKeyCallbacks {
  readonly onTempo: (button: HTMLButtonElement) => void;
  readonly onKey: (button: HTMLButtonElement) => void;
}

export interface TransportTempoKey {
  readonly root: HTMLElement;
  readonly tempo: HTMLButtonElement;
  readonly key: HTMLButtonElement;
  update(transport: TransportView): void;
  setOpen(open: "tempo" | "key" | null): void;
}

export function createTransportTempoKey(callbacks: TransportTempoKeyCallbacks): TransportTempoKey {
  const make = (className: string, onClick: (node: HTMLButtonElement) => void): HTMLButtonElement => {
    const node = element("button", { className: `ui-tempo-key__button ${className}`, attributes: { type: "button", "aria-haspopup": "dialog", "aria-expanded": "false" } });
    node.addEventListener("click", () => onClick(node));
    return node;
  };
  const tempo = make("ui-tempo-key__tempo", callbacks.onTempo);
  const key = make("ui-tempo-key__key", callbacks.onKey);
  const root = element("span", { className: "ui-tempo-key" }, [tempo, element("span", { className: "ui-tempo-key__dot", text: "\u00a0·\u00a0", attributes: { "aria-hidden": "true" } }), key]);
  return {
    root,
    tempo,
    key,
    update(transport) {
      const model = tempoEditorModel({ sounding: transport.bpm, songTempo: transport.songTempo, setBy: transport.tempoSetBy });
      const keyText = formatKey(transport.keyTonic, transport.keyScale);
      setText(tempo, `${bpmText(transport.bpm)} BPM`);
      setText(key, keyText);
      setAttributes(tempo, { "aria-label": model.buttonLabel });
      setAttributes(key, { "aria-label": strings.keyButton(keyText) });
    },
    setOpen(open) {
      tempo.setAttribute("aria-expanded", String(open === "tempo"));
      key.setAttribute("aria-expanded", String(open === "key"));
    },
  };
}
