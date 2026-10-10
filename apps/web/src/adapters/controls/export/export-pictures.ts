// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The pictures a video job carries, drawn on the page where the bundled fonts are: the
// brand mark and closing card (the attribution) and the song's title card and caption.
// Audio carries none. Either one missing means no video, never a
// file in a fallback face: the job ends with exportNoVideo, and a new Render tries again.
import type * as ExportModule from "@untzel/export";
import type { ExportPlan, FrameTitle, VideoBranding } from "@untzel/export";
import type { ExportTitleText } from "../export-sheet/export-title";
export interface ExportPictures {
  readonly branding: VideoBranding;
  readonly title: FrameTitle;
}
type PictureApi = Pick<typeof ExportModule, "prepareVideoBranding" | "prepareTitleOverlays">;
/** null for audio; undefined when the mark or the title cannot be drawn. */
export async function prepareExportPictures(
  api: PictureApi,
  fonts: Pick<FontFaceSet, "load" | "check">,
  logoUrl: string,
  plan: ExportPlan,
  title: ExportTitleText,
): Promise<ExportPictures | null | undefined> {
  const frame = plan.frame;
  if (frame === null) return null;
  const branding = await api.prepareVideoBranding({ fonts, logoUrl, frame });
  if (!branding.ok) {
    console.warn(`export: branding ${branding.reason} unavailable`);
    return undefined;
  }
  const overlays = await api.prepareTitleOverlays({ fonts, frame, title: title.text, detail: title.detail });
  if (!overlays.ok) {
    console.warn("export: title font unavailable");
    closePictures({ branding: branding.branding, title: null });
    return undefined;
  }
  return { branding: branding.branding, title: overlays.overlays };
}
/** Closes whatever was drawn: a job that will not start owns its bitmaps. */
export function closePictures(pictures: { readonly branding: VideoBranding | null; readonly title: FrameTitle | null } | null): void {
  pictures?.branding?.mark.close();
  pictures?.branding?.card.close();
  pictures?.title?.card.close();
  pictures?.title?.caption.close();
}
