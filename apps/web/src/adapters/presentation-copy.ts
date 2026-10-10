// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words the presenters write: the controls' live catalog and the
// instruments' descriptions, both in the page's current language. `liveStrings` is passed
// as the object, never spread or destructured: its getters read the language on each view.
import { liveStrings } from "@untzel/skin";
import type { InstrumentDescriptions, ParameterLabels } from "@untzel/presentation";
import { instrumentDescription, soundDescription } from "../strings/instrument-copy";
export const PRESENTATION_COPY: { readonly labels: ParameterLabels; readonly descriptions: InstrumentDescriptions } = {
  labels: liveStrings,
  descriptions: { instrumentDescription, soundDescription },
};
