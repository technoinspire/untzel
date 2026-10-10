// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// A line of a view that a screen reader should hear when it changes ("Editing bar 2 of 4",
// the step state, the scale warning). The page has one polite region, the shell's
// role="status": a second aria-live paragraph inside a sheet made the share
// announcements ambiguous to find and to hear. So the view keeps its plain paragraph and says the change through the
// shell, which is what the aria-live paragraph did.

export interface SpokenText {
  /** Announces `text` when it differs from the last one said or settled; empty is silent. */
  say(text: string): void;
  /** Takes `text` as already heard, without announcing it: a sheet that just opened. */
  settle(text: string): void;
}

export function createSpokenText(announce: (message: string) => void): SpokenText {
  let last = "";
  return {
    say(text) {
      if (text === last) return;
      last = text;
      if (text !== "") announce(text);
    },
    settle(text) {
      last = text;
    },
  };
}
