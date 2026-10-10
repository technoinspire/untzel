// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Share sheet intents over the session and the source store: the link, the
// .untzel file, and opening a file while the music plays. Both carry the mode and its play
// range beside the text.
import type { ShareIntents } from "@untzel/skin-contract";
import { titleSlug } from "@untzel/core";
import type { AnalyzeResult } from "@untzel/language";
import type { DiagnosticsLog, PlaybackMode, PlayRange, PlayRanges, Session, SourceStore, Unsubscribe } from "@untzel/session";
import {
  UNTZEL_EXTENSION,
  UNTZEL_MIME,
  canShareFiles,
  downloadBlob,
  isUntzelCandidate,
  readUntzelFile,
  saveBlob,
  shareFiles,
  untzelFileName,
  untzelFileText,
} from "@untzel/share";
import { announcements } from "../../strings/copy";
import type { Autosave } from "../../page/autosave";
import { applyReceived, fileFailure } from "../../page/received/received-source";
import type { ShareView } from "@untzel/presentation/view-model";

const SHARE_TITLE = "Untzel";
const ACCEPT = { description: "Untzel song", accept: { [UNTZEL_MIME]: [UNTZEL_EXTENSION] } };

export interface ShareControlsOptions {
  readonly session: Session;
  /** The play range sent beside the mode, and the one a received file or link brings. */
  readonly ranges: Pick<PlayRanges, "rangeOf" | "receive" | "subscribe">;
  readonly store: SourceStore;
  readonly analyze: (source: string) => AnalyzeResult;
  readonly autosave: () => Autosave;
  /** A received link's "Remix of <title>". */
  readonly retitle: (source: string, origin: "link" | "file") => string;
  readonly announce: (message: string) => void;
  readonly log: DiagnosticsLog;
  readonly now: () => Date;
  /** Tests replace the browser. */
  readonly navigator?: Pick<Navigator, "share" | "canShare" | "clipboard" | "platform">;
}

type Listener = () => void;

export class ShareControls implements ShareIntents {
  readonly #options: ShareControlsOptions;
  readonly #navigator: Pick<Navigator, "share" | "canShare" | "clipboard" | "platform">;
  readonly #listeners = new Set<Listener>();
  #view: ShareView;
  #request = 0;
  /** The text, mode and range of the link shown (or being built); null without one. */
  #linked: { readonly source: string; readonly mode: PlaybackMode | null; readonly range: string } | null = null;
  #unsubscribe: Unsubscribe | null = null;

  constructor(options: ShareControlsOptions) {
    this.#options = options;
    this.#navigator = options.navigator ?? navigator;
    this.#view = {
      link: { kind: "pending" },
      isLastValid: false,
      canShareLink: typeof this.#navigator.share === "function",
      canShareFile: canShareFiles([this.#file("", "text/plain")], { navigator: this.#navigator }),
      isCopied: false,
      isCopyRefused: false,
    };
  }

  view(): ShareView {
    return this.#view;
  }

  onChange(listener: Listener): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * The Share sheet opened. While it stays open, a change of the shareable text (a track
   * table edit or a shortcut beside the desktop panel), of the mode or of the play range
   * builds the link again, so Copy link and Share link never send an older version.
   */
  prepareShare(): void {
    if (this.#unsubscribe === null) {
      const rebuild = (): void => {
        const source = this.#options.session.shareableSource()?.source;
        const linked = this.#linked;
        if (linked === null || source !== linked.source || this.#mode() !== linked.mode || rangeKey(this.#range()) !== linked.range) this.#buildLink();
      };
      const unsubscribers: Unsubscribe[] = [this.#options.session.subscribe(rebuild), this.#options.ranges.subscribe(rebuild)];
      this.#unsubscribe = () => unsubscribers.forEach((unsubscribe) => unsubscribe());
    }
    this.#buildLink();
  }

  closeShare(): void {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    this.#request += 1;
  }

  #buildLink(): void {
    const shareable = this.#options.session.shareableSource();
    const mode = this.#mode();
    const range = this.#range();
    this.#linked = shareable === null ? null : { source: shareable.source, mode, range: rangeKey(range) };
    this.#request += 1;
    const request = this.#request;
    this.#set({
      link: shareable === null ? { kind: "unavailable" } : { kind: "pending" },
      isLastValid: shareable !== null && !shareable.isCurrent,
      isCopied: false,
      isCopyRefused: false,
    });
    if (shareable === null) return;
    this.#options.store.link(shareable.source, mode, range).then(
      (link) => {
        if (request !== this.#request) return;
        this.#set({ link: link.kind === "link" ? { kind: "ready", url: link.url, length: link.length } : link });
      },
      (error: unknown) => {
        this.#options.log.internalError("share", error);
        if (request === this.#request) this.#set({ link: { kind: "unavailable" } });
      },
    );
  }

  /** Inside the click, with no await before navigator.share. */
  shareLink(): void {
    const link = this.#view.link;
    if (link.kind !== "ready" || typeof this.#navigator.share !== "function") return;
    this.#noteLastValid();
    this.#navigator.share({ title: this.#shareTitle(), url: link.url }).catch((error: unknown) => {
      if (nameOf(error) !== "AbortError") this.copyLink();
    });
  }

  copyLink(): void {
    const link = this.#view.link;
    if (link.kind !== "ready") return;
    this.#noteLastValid();
    const clipboard = this.#navigator.clipboard as Clipboard | undefined;
    const refused = (): void => {
      this.#set({ isCopied: false, isCopyRefused: true });
      this.#options.announce(announcements.pressToCopy(/^(Mac|iPhone|iPad)/.test(this.#navigator.platform)));
    };
    if (clipboard === undefined) return refused();
    clipboard.writeText(link.url).then(() => {
      this.#set({ isCopied: true, isCopyRefused: false });
      this.#options.announce(announcements.linkCopied);
    }, refused);
  }

  /** The current text, even when it does not play: a file is work in progress. */
  saveFile(): void {
    const name = this.#fileName();
    const blob = new Blob([untzelFileText(this.#options.session.state().source, this.#mode(), this.#range())], { type: UNTZEL_MIME });
    void saveBlob(blob, name, ACCEPT).then((outcome) => {
      if (outcome === "saved") this.#options.announce(announcements.savedAs(name));
      if (outcome === "downloaded") this.#options.announce(announcements.downloaded(name));
    });
  }

  /** The last version that plays, through the system share sheet; a download otherwise. */
  shareFile(): void {
    const shareable = this.#options.session.shareableSource();
    if (shareable === null) return;
    const name = this.#fileName();
    const typed = this.#file(shareable.source, UNTZEL_MIME, name);
    const file = canShareFiles([typed], { navigator: this.#navigator }) ? typed : this.#file(shareable.source, "text/plain", name);
    if (!shareable.isCurrent) this.#options.announce(announcements.lastValidShared);
    void shareFiles([file], this.#shareTitle(), { navigator: this.#navigator, download: downloadBlob }).then((outcome) => {
      if (outcome !== "unsupported") return;
      downloadBlob(file, name);
      this.#options.announce(announcements.downloadedInstead);
    });
  }

  /** `midnight-coast.untzel` from the title; the dated name without one. */
  #fileName(): string {
    return untzelFileName(titleSlug(this.#options.session.view().title ?? ""), this.#options.now());
  }
  /** The song's title in the system share sheet, "Untzel" without one. */
  #shareTitle(): string {
    return this.#options.session.view().title ?? SHARE_TITLE;
  }
  /** While running: read, analyze, and play on the next bar only when the text is valid. */
  openFile(file: File): void {
    if (!isUntzelCandidate(file)) return this.#options.announce(announcements.fileNotSong);
    void readUntzelFile(file).then((read) => {
      if (!read.ok) return this.#options.announce(fileFailure(read.reason));
      const received = { source: read.source, mode: read.mode, range: read.range, origin: "file", formatVersion: read.formatVersion } as const;
      applyReceived(received, file.name, this.#dependencies());
    });
  }

  /** A link that arrives while the music plays (hashchange). */
  receiveLink(source: string, mode: PlaybackMode | null, range: PlayRange | null): void {
    applyReceived({ source, mode, range, origin: "link", formatVersion: null }, announcements.sharedMusic, this.#dependencies());
  }

  /** The mode the music plays in, carried by the link and the file. */
  #mode(): PlaybackMode | null {
    return this.#options.session.view().mode;
  }

  /** The play range of that mode, carried with it. */
  #range(): PlayRange | null {
    return this.#options.ranges.rangeOf(this.#mode());
  }

  #dependencies() {
    return {
      analyze: this.#options.analyze,
      session: this.#options.session,
      ranges: this.#options.ranges,
      autosave: this.#options.autosave(),
      announce: this.#options.announce,
      retitle: this.#options.retitle,
    };
  }

  #file(source: string, type: string, name = `untzel${UNTZEL_EXTENSION}`): File {
    return new File([untzelFileText(source, this.#mode(), this.#range())], name, { type });
  }

  #noteLastValid(): void {
    if (this.#view.isLastValid) this.#options.announce(announcements.lastValidShared);
  }

  #set(change: Partial<ShareView>): void {
    this.#view = { ...this.#view, ...change };
    for (const listener of this.#listeners) listener();
  }
}

function nameOf(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
}

/** A range as a string, to tell whether the link shown still carries the one that plays. */
function rangeKey(range: PlayRange | null): string {
  return range === null ? "" : `${range.startBar}-${range.endBar}-${range.cycle}`;
}
