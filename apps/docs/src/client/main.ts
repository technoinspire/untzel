// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// The only script of the docs. Everything it adds is optional: without it the pages, the
// prompt and the language links are complete.
import { browserLocaleStore, enhanceLanguageLinks } from "@untzel/i18n/dom";
import "../styles/docs.css";
import { setupCopyButtons } from "./copy";
import { setupSearch } from "./search";

enhanceLanguageLinks(document, browserLocaleStore(), () => location.hash);
setupCopyButtons(document);
setupSearch(document.querySelector<HTMLElement>("[data-search]"));
