// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The credits of the third-party material the build bundles, from credits.json at the root
// (the machine-readable twin of THIRD_PARTY.md): no credit is written by hand on a page.
// The licensor's own words (title, performers, citation, changes) stay in English, marked
// lang="en"; only the labels around them follow the page.
import type { RenderContext } from "../content/context";
import { html, type SafeHtml } from "../render/html";
import type { Credit } from "../content/sources";
import { DirectiveError, markdownTable, type Directive } from "./types";

type Row = readonly [string, string, string | null];
/** The fields a credit has, in a fixed order; a sample library without performers or a DOI has no such row. */
function rows(credit: Credit, context: RenderContext): readonly Row[] {
  const text = context.text;
  const all: readonly (Row | null)[] = [
    [text.creditAuthors, context.formatters.list(credit.authors), null],
    credit.performers === null ? null : [text.creditPerformers, credit.performers, null],
    [text.creditLicense, credit.license.name, credit.license.url],
    [text.creditSource, credit.url, credit.url],
    credit.doi === null ? null : ["DOI", credit.doi, `https://doi.org/${credit.doi}`],
    [text.creditUsedBy, context.formatters.list(credit.usedBy), null],
    [text.creditChanges, credit.changes, null],
  ];
  return all.filter((row): row is Row => row !== null);
}
function value(label: string, shown: string, href: string | null, context: RenderContext): SafeHtml {
  const isLicensorText = label === context.text.creditPerformers || label === context.text.creditChanges;
  if (href !== null) return html`<a href="${href}" rel="noopener">${shown}</a>`;
  return isLicensorText ? html`<span lang="en">${shown}</span>` : html`${shown}`;
}

function creditHtml(credit: Credit, context: RenderContext): SafeHtml {
  return html`<h2 id="${credit.id}" lang="en">${credit.title}</h2>
<dl class="facts" data-credit="${credit.id}">${rows(credit, context).map(([label, shown, href]) => html`<div><dt>${label}</dt><dd>${value(label, shown, href, context)}</dd></div>`)}</dl>
${credit.citation === null ? html`` : html`<p class="caption">${context.text.creditCitation}</p>
<blockquote lang="en"><p>${credit.citation}</p></blockquote>`}`;
}

export const credits: Directive = (_, context) => {
  const all = context.data.sources.credits;
  if (all.length === 0) throw new DirectiveError("credits.json lists no credit");
  return {
    html: html`${all.map((credit) => creditHtml(credit, context))}`,
    markdown: all
      .map((credit) =>
        [`## ${credit.title}`, markdownTable([context.text.creditField, context.text.value], rows(credit, context).map(([label, shown]) => [label, shown])), ...(credit.citation === null ? [] : [`> ${credit.citation}`])].join("\n\n"),
      )
      .join("\n\n"),
  };
};
