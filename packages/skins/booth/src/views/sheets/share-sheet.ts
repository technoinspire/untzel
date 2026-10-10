// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Sharing a song: the link with the source in it, copy or share it, or carry the song as a file.
// One primary action: Copy link on desktop and where navigator.share does not exist,
// Share link elsewhere; Save file when the song is too long for a link. Opening a file is
// the menu's (Open file…), not this sheet's.
import { button, element, setText } from "../dom";
import type { ShareIntents } from "@untzel/skin-contract";
import type { UntzelView } from "@untzel/presentation/view-model";
import { strings, text } from "../../copy/copy";
import { shareSheetModel, type ShareSheetModel } from "./share-sheet-model";
import { createSheet, type Sheet } from "./sheet";

const PRIMARY = "ui-pill ui-pill--primary ui-share__action";
const SECONDARY = "ui-pill ui-pill--outline ui-share__action";

export interface ShareSheet extends Sheet {
  update(view: UntzelView, isDesktop: boolean): void;
}

/** The file actions, in order: Save file always, Share file where the system takes files. */
export function fileActions(model: Pick<ShareSheetModel, "isShareFileShown">): readonly string[] {
  return model.isShareFileShown ? [strings.saveFile, strings.shareFile] : [strings.saveFile];
}
// Over 40 lines: one sheet built and updated, nothing else.
export function createShareSheet(intents: ShareIntents, onClose: () => void): ShareSheet {
  const sheet = createSheet({ id: "ui-share", title: text.share, className: "ui-sheet--share", onClose });
  const fieldId = "ui-share-link";
  const field = element("input", {
    className: "ui-share__field",
    attributes: { id: fieldId, type: "text", readonly: true, spellcheck: false, autocomplete: "off" },
  });
  const length = element("p", { className: "ui-share__length", attributes: { id: `${fieldId}-length` } });
  field.setAttribute("aria-describedby", length.id);
  const linkBlock = element("div", { className: "ui-share__link" }, [
    element("label", { className: "ui-share__label", text: text.link, attributes: { for: fieldId } }),
    field,
    length,
  ]);
  const note = element("p", { className: "ui-share__note" });
  const lastValid = element("p", { className: "ui-share__note", text: text.lastValidShared });
  const shareLink = button(PRIMARY, text.shareLink, () => intents.shareLink());
  const copyLink = button(SECONDARY, text.copyLink, () => intents.copyLink());
  const saveFile = button(SECONDARY, text.saveFile, () => intents.saveFile());
  const shareFile = button(SECONDARY, text.shareFile, () => intents.shareFile());
  const linkActions = element("div", { className: "ui-share__actions" }, [shareLink, copyLink]);
  const fileActions = element("div", { className: "ui-share__actions" }, [saveFile, shareFile]);
  sheet.body.append(linkBlock, note, lastValid, linkActions, fileActions);

  let wasRefused = false;
  return {
    ...sheet,
    update(view, isDesktop) {
      const share = view.share;
      const model = shareSheetModel(share, isDesktop);
      linkBlock.hidden = !model.isLinkShown;
      linkActions.hidden = !model.isLinkShown;
      if (model.isLinkShown && field.value !== model.url) field.value = model.url;
      setText(length, model.lengthText);
      note.hidden = model.isLinkShown;
      setText(note, model.noteText);
      lastValid.hidden = !model.isLastValidShown;
      shareLink.hidden = !model.isShareLinkShown;
      setText(copyLink, model.copyLinkText);
      shareFile.hidden = !model.isShareFileShown;
      shareLink.className = model.linkPrimary === "share-link" ? PRIMARY : SECONDARY;
      copyLink.className = model.linkPrimary === "copy-link" ? PRIMARY : SECONDARY;
      saveFile.className = model.isSaveFilePrimary ? PRIMARY : SECONDARY;
      if (share.isCopyRefused && !wasRefused) {
        field.focus();
        field.select();
      }
      wasRefused = share.isCopyRefused;
    },
  };
}
