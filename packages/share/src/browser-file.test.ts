// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it, vi } from "vitest";
import { saveBlob, shareFiles, type FileEnvironment } from "./browser-file";

const ACCEPT = { description: "Untzel song", accept: { "text/x-untzel": [".untzel"] } };
const abort = () => new DOMException("cancelled", "AbortError");

function environment(overrides: Partial<FileEnvironment> = {}): FileEnvironment & { downloads: string[] } {
  const downloads: string[] = [];
  return { navigator: {}, download: (_blob, name) => downloads.push(name), ...overrides, downloads };
}

describe("saveBlob", () => {
  it("writes through the save dialog where it exists", async () => {
    const written: Blob[] = [];
    const env = environment({
      showSaveFilePicker: () =>
        Promise.resolve({
          createWritable: () =>
            Promise.resolve({ write: (data: Blob) => Promise.resolve(void written.push(data)), close: () => Promise.resolve() }),
        }),
    });
    expect(await saveBlob(new Blob(["a"]), "a.untzel", ACCEPT, env)).toBe("saved");
    expect(written).toHaveLength(1);
    expect(env.downloads).toEqual([]);
  });

  it("does nothing when the person cancels the dialog", async () => {
    const env = environment({ showSaveFilePicker: () => Promise.reject(abort()) });
    expect(await saveBlob(new Blob(["a"]), "a.untzel", ACCEPT, env)).toBe("cancelled");
    expect(env.downloads).toEqual([]);
  });

  it("downloads when the dialog fails for another reason or does not exist", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const failing = environment({ showSaveFilePicker: () => Promise.reject(new DOMException("no", "SecurityError")) });
    expect(await saveBlob(new Blob(["a"]), "a.untzel", ACCEPT, failing)).toBe("downloaded");
    expect(failing.downloads).toEqual(["a.untzel"]);
    const none = environment();
    expect(await saveBlob(new Blob(["a"]), "b.untzel", ACCEPT, none)).toBe("downloaded");
    expect(none.downloads).toEqual(["b.untzel"]);
    warn.mockRestore();
  });
});

describe("shareFiles", () => {
  const file = new File(["a"], "a.untzel", { type: "text/plain" });

  it("is unsupported without navigator.share or when canShare refuses", async () => {
    expect(await shareFiles([file], "Untzel", environment())).toBe("unsupported");
    const refusing = environment({ navigator: { canShare: () => false, share: () => Promise.resolve() } });
    expect(await shareFiles([file], "Untzel", refusing)).toBe("unsupported");
  });

  it("shares, reports a cancel, and turns other refusals into unsupported", async () => {
    const ok = environment({ navigator: { canShare: () => true, share: () => Promise.resolve() } });
    expect(await shareFiles([file], "Untzel", ok)).toBe("shared");
    const cancelled = environment({ navigator: { canShare: () => true, share: () => Promise.reject(abort()) } });
    expect(await shareFiles([file], "Untzel", cancelled)).toBe("cancelled");
    const expired = environment({
      navigator: { canShare: () => true, share: () => Promise.reject(new DOMException("gesture", "NotAllowedError")) },
    });
    expect(await shareFiles([file], "Untzel", expired)).toBe("unsupported");
  });
});
