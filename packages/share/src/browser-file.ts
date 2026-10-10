// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Saving and sharing files with what each browser has (measured):
// showSaveFilePicker only in Chrome, navigator.share with files where it exists, and a
// download everywhere else. Unit tests pass fakes for the environment.

export type SaveOutcome = "saved" | "downloaded" | "cancelled";
export type ShareOutcome = "shared" | "cancelled" | "unsupported";

export interface FilePickerAcceptType {
  readonly description: string;
  readonly accept: Readonly<Record<string, readonly string[]>>;
}

interface WritableFile {
  write(data: Blob): Promise<void>;
  close(): Promise<void>;
}
interface SaveFileHandle {
  createWritable(): Promise<WritableFile>;
}
type SaveFilePicker = (options: {
  readonly suggestedName: string;
  readonly types: readonly FilePickerAcceptType[];
}) => Promise<SaveFileHandle>;

/** What the functions use from the page; window and document by default. */
export interface FileEnvironment {
  readonly showSaveFilePicker?: SaveFilePicker | undefined;
  readonly navigator: Pick<Navigator, "share" | "canShare"> | Partial<Pick<Navigator, "share" | "canShare">>;
  readonly download: (blob: Blob, name: string) => void;
}

/** The Blob URL lives on for a minute: Safari needs it while the download runs. */
const REVOKE_AFTER_MS = 60_000;

export function pageFileEnvironment(): FileEnvironment {
  const picker = (window as unknown as { readonly showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  return {
    showSaveFilePicker: picker?.bind(window),
    navigator,
    download: downloadBlob,
  };
}

/** <a download> outside the document with a Blob URL, revoked later. */
export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}

/** showSaveFilePicker where it exists; any refusal other than a cancel falls back to a download. */
export async function saveBlob(
  blob: Blob,
  name: string,
  accept: FilePickerAcceptType,
  environment: FileEnvironment = pageFileEnvironment(),
): Promise<SaveOutcome> {
  const picker = environment.showSaveFilePicker;
  if (picker !== undefined) {
    try {
      const handle = await picker({ suggestedName: name, types: [accept] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "saved";
    } catch (error) {
      if (isAbort(error)) return "cancelled";
      console.warn(`share: the save dialog failed (${errorName(error)}); downloading instead`);
    }
  }
  environment.download(blob, name);
  return "downloaded";
}

/**
 * canShare({ files }) and share({ files }). Call it inside the click, with no await
 * before it: share needs the transient activation of the gesture.
 */
export async function shareFiles(
  files: readonly File[],
  title: string,
  environment: FileEnvironment = pageFileEnvironment(),
): Promise<ShareOutcome> {
  const data: ShareData = { files: [...files], title };
  const { share, canShare } = environment.navigator;
  if (share === undefined || canShare === undefined || !canShare.call(environment.navigator, data)) {
    return "unsupported";
  }
  try {
    await share.call(environment.navigator, data);
    return "shared";
  } catch (error) {
    if (isAbort(error)) return "cancelled";
    return "unsupported"; // NotAllowedError (expired gesture), TypeError: the caller downloads
  }
}

/** True when the browser would accept these files in navigator.share. */
export function canShareFiles(
  files: readonly File[],
  environment: Pick<FileEnvironment, "navigator"> = { navigator },
): boolean {
  const { share, canShare } = environment.navigator;
  if (share === undefined || canShare === undefined) return false;
  try {
    return canShare.call(environment.navigator, { files: [...files] });
  } catch {
    return false;
  }
}

function isAbort(error: unknown): boolean {
  return errorName(error) === "AbortError";
}

function errorName(error: unknown): string {
  return typeof error === "object" && error !== null && "name" in error ? String(error.name) : "unknown";
}
