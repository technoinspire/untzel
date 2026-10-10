// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The words the presenters write into the view model, injected by the composition:
// the controls' live catalog and the instruments' descriptions, both in the
// page's current language. Presentation never imports a catalog.
export interface ParameterLabels {
  readonly panCenter: string;
  readonly panLeft: (percent: number) => string;
  readonly panRight: (percent: number) => string;
  readonly signalOver: (shape: string, bars: string, range: string) => string;
  readonly gainRange: (low: string, high: string) => string;
}
export interface InstrumentDescriptions {
  instrumentDescription(instrument: string, english: string): string;
  soundDescription(instrument: string, sound: string, english: string): string;
}
