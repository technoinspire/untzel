// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The export sheet's ruler shows the bar that plays, as the transport's ruler
// does: only when the stretch's mode is the one that sounds. Pure.
import type { ExportView, TransportView } from "./view-model";

export function withExportPlayhead(view: ExportView, transport: TransportView): ExportView {
  const stretch = view.stretch;
  if (stretch === null || !transport.isPlaying || stretch.mode !== transport.mode) return view;
  const bar = transport.mode === "loop" ? transport.loopBar : transport.bar;
  return bar === null || bar === stretch.playheadBar ? view : { ...view, stretch: { ...stretch, playheadBar: bar } };
}
