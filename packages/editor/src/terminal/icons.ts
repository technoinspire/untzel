// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

// The terminal's drawn signs; colors come from CSS through currentColor.

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(className: string, viewBox: string, body: string): SVGSVGElement {
  const node = document.createElementNS(SVG_NS, "svg");
  node.setAttribute("class", className);
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("aria-hidden", "true");
  node.setAttribute("focusable", "false");
  // Static markup written here, never text from the person.
  node.innerHTML = body;
  return node;
}

const STROKE = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

/** The prompt: the kick's shock wave, a dot and two arcs. Never "$" or ">". */
export function promptGlyph(className = "ut-glyph"): SVGSVGElement {
  return svg(
    className,
    "0 0 18 18",
    `<circle cx="4" cy="9" r="2.6" fill="currentColor"/>` +
      `<path d="M8.01 4.54 A6 6 0 0 1 8.01 13.46" ${STROKE}/>` +
      `<path d="M11.03 1.20 A10.5 10.5 0 0 1 11.03 16.80" ${STROKE}/>`,
  );
}

/** Applied: a drawn check mark. */
export function tickIcon(): SVGSVGElement {
  return svg("ut-tick", "0 0 14 12", `<path d="M1 6 L5 10 L13 1" ${STROKE}/>`);
}

/** Run the line: a return arrow. */
export function runIcon(): SVGSVGElement {
  return svg("ut-run-icon", "0 0 20 20", `<path d="M17 2 V11 H3 M7 7 L3 11 L7 15" ${STROKE}/>`);
}
