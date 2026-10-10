// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import type { AppPhase } from "@untzel/presentation/view-model";
import type { UiState } from "./navigation";

export interface AppAttributesInput {
  readonly ui: UiState;
  readonly phase: AppPhase;
  readonly mode: "loop" | "song";
  readonly isDesktop: boolean;
  readonly isCollapsed: boolean;
}

/** The data-* values of .ui-app the stylesheet lays the screens out by, in writing order. */
export interface AppAttributes {
  readonly phase: AppPhase;
  readonly tab: string;
  readonly panel: string;
  readonly code: "shown" | "hidden";
  readonly overlay: string;
  readonly layout: "desktop" | "mobile";
  readonly collapsed: string;
  readonly mode: string;
}

export function appAttributes({ ui, phase, mode, isDesktop, isCollapsed }: AppAttributesInput): AppAttributes {
  return {
    phase,
    tab: ui.tab,
    panel: ui.panel ?? "none",
    code: ui.isCodeShown ? "shown" : "hidden",
    overlay: ui.overlay ?? "none",
    layout: isDesktop ? "desktop" : "mobile",
    collapsed: String(isCollapsed),
    // Loop mode: the Length chip and the ruler; song mode: the parts list.
    mode: phase === "running" ? mode : "none",
  };
}
