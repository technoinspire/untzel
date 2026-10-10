// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Copy buttons. Born hidden in the HTML; shown here. Without clipboard access the text is
// selected and the button says which keys copy it.

const RESET_MS = 2000;

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
}

function select(target: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(target);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function announce(button: HTMLButtonElement, text: string): void {
  const label = button.querySelector("span");
  if (label === null) return;
  const original = label.textContent ?? "";
  label.textContent = text;
  window.setTimeout(() => {
    label.textContent = original;
  }, RESET_MS);
}

async function copy(button: HTMLButtonElement): Promise<void> {
  const target = document.getElementById(button.dataset["copy"] ?? "");
  if (target === null) return;
  try {
    await navigator.clipboard.writeText(target.textContent ?? "");
    announce(button, button.dataset["copied"] ?? "");
  } catch {
    select(target);
    announce(button, (button.dataset["fallback"] ?? "").replace("{key}", isMac() ? "Cmd" : "Ctrl"));
  }
}

export function setupCopyButtons(root: ParentNode): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-copy]")) {
    button.hidden = false;
    button.addEventListener("click", () => void copy(button));
  }
}
