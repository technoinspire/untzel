// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The document around every page: header with the attribution, menu, language switch,
// search and footer. One stylesheet and one module script, no inline style or script.
import { ATTRIBUTION } from "@untzel/skin-booth";
import { LOCALES, renderSwitchHtml, switchModel, type Locale } from "@untzel/i18n";
import { PAGE_IDS, type PageId } from "../../../../apps/docs/src/pages";
import type { RenderContext } from "../content/context";
import { html, trusted, type SafeHtml } from "./html";
import { icon } from "./icons";
import { absoluteUrl, appHref, depthOf, pagePath, relativeHref, rootPrefix } from "../content/site";

export interface ClientAssets {
  /** Paths below the docs root. */
  readonly script: string;
  readonly styles: readonly string[];
}

export interface PageFrame {
  readonly id: PageId;
  readonly title: string;
  readonly description: string;
  readonly body: SafeHtml;
  /** The page is shown in English on a pt-BR URL. */
  readonly untranslated: boolean;
  readonly assets: ClientAssets;
  /** Menu titles in this locale, by page. */
  readonly menuTitles: ReadonlyMap<PageId, string>;
}

/** The Graphic Image of ATTRIBUTION.md, the Untzel wordmark for dark backgrounds. */
export const LOGO_PATH = "brand/untzel-wordmark-dark.svg";
export const FAVICON_PATH = "favicon.svg";

function menu(context: RenderContext, frame: PageFrame): SafeHtml {
  const items = PAGE_IDS.map((id) => {
    const href = relativeHref(context.path, pagePath(id, context.locale));
    const current = id === frame.id ? html` aria-current="page"` : "";
    return html`<li><a href="${href}"${current}>${frame.menuTitles.get(id) ?? id}</a></li>`;
  });
  return html`<ul class="menu__list">${items}</ul>`;
}

function alternates(frame: PageFrame): SafeHtml {
  const links = LOCALES.map((locale) => html`<link rel="alternate" hreflang="${locale}" href="${absoluteUrl(pagePath(frame.id, locale))}">`);
  return html`${links}<link rel="alternate" hreflang="x-default" href="${absoluteUrl(pagePath(frame.id, "en"))}">`;
}

function languageSwitch(context: RenderContext, frame: PageFrame): SafeHtml {
  const model = switchModel(context.locale, (locale: Locale) => relativeHref(context.path, pagePath(frame.id, locale)));
  return trusted(renderSwitchHtml(model, { group: context.text.languageGroup }));
}

function search(context: RenderContext, prefix: string): SafeHtml {
  const text = context.text;
  return html`<div class="search" data-search data-index="${prefix}search.${context.locale}.json" data-root="${prefix}" data-unavailable="${text.searchUnavailable}" data-empty="${text.searchEmpty}" hidden>
<label class="search__label" for="search-input">${icon("search")}<span class="visually-hidden">${text.search}</span></label>
<input class="search__input" id="search-input" type="search" maxlength="100" autocomplete="off" spellcheck="false" placeholder="${text.searchPlaceholder}">
<ul class="search__results" role="list" aria-live="polite"></ul>
</div>`;
}

function header(context: RenderContext, frame: PageFrame, prefix: string): SafeHtml {
  const text = context.text;
  return html`<header class="masthead">
<div class="masthead__brand">
<a class="masthead__logo" href="${ATTRIBUTION.url}"><img src="${prefix}${LOGO_PATH}" alt="${ATTRIBUTION.logoAlt}" width="${ATTRIBUTION.logoWidth}" height="${ATTRIBUTION.logoHeight}"></a>
<span class="masthead__divider" aria-hidden="true"></span>
<span class="masthead__name">${text.docsName}</span>
<p class="masthead__phrase">${ATTRIBUTION.phrase}</p>
</div>
<div class="masthead__actions">
${search(context, prefix)}
${languageSwitch(context, frame)}
<a class="button button--primary" href="${appHref()}" data-app-link>${icon("open")}<span>${text.openApp}</span></a>
</div>
</header>`;
}

function neighbours(context: RenderContext, frame: PageFrame): SafeHtml {
  const index = PAGE_IDS.indexOf(frame.id);
  const link = (id: PageId | undefined, label: string, className: string): SafeHtml =>
    id === undefined
      ? html``
      : html`<a class="pager__link ${className}" href="${relativeHref(context.path, pagePath(id, context.locale))}"><span class="pager__label">${label}</span><span class="pager__title">${frame.menuTitles.get(id) ?? id}</span></a>`;
  return html`<nav class="pager" aria-label="${context.text.previous} / ${context.text.next}">${link(PAGE_IDS[index - 1], context.text.previous, "pager__link--previous")}${link(PAGE_IDS[index + 1], context.text.next, "pager__link--next")}</nav>`;
}

// Over 40 lines: one HTML template of the whole page, in document order.
export function renderDocument(context: RenderContext, frame: PageFrame): string {
  const text = context.text;
  const prefix = rootPrefix(depthOf(context.path));
  const mainLang = frame.untranslated ? html` lang="en"` : "";
  const notice = frame.untranslated ? html`<p class="notice">${text.untranslated}</p>` : "";
  const styles = frame.assets.styles.map((style) => html`<link rel="stylesheet" href="${prefix}${style}">`);
  const document = html`<!doctype html>
<html lang="${context.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text.pageTitle(frame.title)}</title>
<meta name="description" content="${frame.description}">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0B0B0C">
<link rel="canonical" href="${absoluteUrl(context.path)}">
${alternates(frame)}
<link rel="icon" href="${prefix}${FAVICON_PATH}" type="image/svg+xml">
${styles}
<script type="module" src="${prefix}${frame.assets.script}"></script>
</head>
<body>
<a class="skip-link" href="#main">${text.skipToContent}</a>
${header(context, frame, prefix)}
<div class="layout">
<nav class="sidebar" aria-label="${text.pagesNavigation}">${menu(context, frame)}</nav>
<details class="menu">
<summary class="menu__toggle">${icon("menu")}<span>${text.menu}</span></summary>
<nav aria-label="${text.pagesNavigation}">${menu(context, frame)}</nav>
</details>
<main id="main" class="content" tabindex="-1"${mainLang}>
${notice}
<article class="prose">
${frame.body}
</article>
${neighbours(context, frame)}
</main>
</div>
<footer class="footer">
<p>${ATTRIBUTION.copyright} · ${text.license} · <a href="${ATTRIBUTION.url}">${text.siteLink}</a></p>
</footer>
</body>
</html>
`;
  return document.value;
}
