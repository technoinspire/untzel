// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

import { element } from "../dom";

/**
 * The attribution CPAL-1.0 Exhibit B requires (see
 * ATTRIBUTION.md). Fixed values: there is no option to change or hide them, and every
 * surface (this shell, the future <untzel-player>) renders them through these functions.
 */
export const ATTRIBUTION = {
  url: "https://untzel.com",
  phrase: "Powered by Untzel · Techno Inspire",
  copyright: "Copyright (c) 2026 Techno Inspire",
  logoAlt: "Untzel",
  /** viewBox of brand/untzel/untzel-wordmark-dark.svg, the Graphic Image. */
  logoWidth: 238,
  logoHeight: 68,
} as const;

/** The Graphic Image, linked to the Attribution URL: the top bar's first item. */
export function createAttributionLogo(logoUrl: string): HTMLAnchorElement {
  const logo = element("img", {
    className: "ui-attribution__logo",
    attributes: {
      src: logoUrl,
      alt: ATTRIBUTION.logoAlt,
      width: ATTRIBUTION.logoWidth,
      height: ATTRIBUTION.logoHeight,
      decoding: "async",
    },
  });
  return element("a", { className: "ui-attribution__link", attributes: { href: ATTRIBUTION.url } }, [logo]);
}

/** The Attribution Phrase in the footer of the shell, always on screen. */
export function createAttributionFooter(): HTMLElement {
  const phrase = element("p", { className: "ui-attribution__phrase", text: ATTRIBUTION.phrase });
  return element("footer", { className: "ui-footer", attributes: { "data-attribution": "" } }, [phrase]);
}
