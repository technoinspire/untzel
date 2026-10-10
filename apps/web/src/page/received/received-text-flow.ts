// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Text that reaches the page from outside (a link in the address bar, a file picked or
// dropped on the waiting stage): checked by the engine's analysis before the tap, or
// handed to the running music. Part of the initial JS.
import { isUntzelCandidate, readUntzelFile } from "@untzel/share/untzel-file";
import type { App } from "../../boot";
import { announcements } from "../../strings/copy";
import type { DeferredControlsPort } from "../deferred-controls-port";
import type { ReceivedText } from "../waiting/waiting-stage";
import { fileFailure, readAddressLink } from "./received-source";

export interface ReceivedTextFlow {
  /** The address bar's link, at load and on hashchange: on the waiting stage, or into the music. */
  readLink(): void;
  /** A file picked or dropped before the tap. */
  openFileWhileWaiting(file: File): void;
}

export interface ReceivedTextOptions {
  /** Late-bound: the port is made after the flow, as the file reader is one of its actions. */
  readonly port: () => Pick<DeferredControlsPort, "receive" | "notice" | "announce" | "isRunning">;
  readonly app: () => Promise<App>;
}

/** Text received on the waiting stage: checked by the engine's analysis before the tap. */
function receive(options: ReceivedTextOptions, text: ReceivedText, rejected: (message: string) => string): void {
  const { port, app } = options;
  app()
    .then((loaded) => {
      const inspected = loaded.inspect(text.source);
      if (inspected.ok) port().receive(text);
      else {
        console.info(`${text.origin}: invalid text`);
        port().notice({ kind: "failed", message: rejected(inspected.message) });
      }
    })
    .catch(() => port().notice({ kind: "failed", message: announcements.linkFailed }));
}

export function createReceivedTextFlow(options: ReceivedTextOptions): ReceivedTextFlow {
  const { port, app } = options;
  const readLink = (): void => {
    void readAddressLink(window.location, window.history).then((decoded) => {
      if (decoded === null) return;
      if (!decoded.ok) {
        if (port().isRunning) port().announce(announcements.linkFailed);
        else port().notice({ kind: "failed", message: announcements.linkFailed });
        return;
      }
      const text = { source: decoded.source, origin: "link", mode: decoded.mode, range: decoded.range } as const;
      if (port().isRunning) void app().then((loaded) => loaded.receiveLink(text.source, text.mode, text.range));
      else receive(options, text, () => announcements.linkFailed);
    });
  };
  const openFileWhileWaiting = (file: File): void => {
    if (!isUntzelCandidate(file)) return port().notice({ kind: "failed", message: announcements.fileNotSong });
    void readUntzelFile(file).then((read) => {
      if (!read.ok) return port().notice({ kind: "failed", message: fileFailure(read.reason) });
      const isNewer = read.formatVersion !== null && read.formatVersion > 1;
      receive(options, { source: read.source, origin: "file", mode: read.mode, range: read.range }, (message) => (isNewer ? announcements.fileNeedsNewer : announcements.fileHasErrors(message)));
    });
  };
  return { readLink, openFileWhileWaiting };
}
