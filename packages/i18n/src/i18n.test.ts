// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
import { describe, expect, it } from "vitest";
import { bindCatalog, defineTranslation, messagesOf, referenced } from "./catalog";
import { enhanceLanguageLinks, readSavedLocale, saveLocale, type LocaleStore } from "./dom/index";
import { createFormatters } from "./formatters";
import { matchLocale, resolveLocale } from "./locales";
import { renderSwitchHtml, switchModel } from "./switch-model";
import { createTranslator, createTranslatorSlot } from "./translator";

const source = {
  play: "Play",
  tracks: (count: number) => `${count} tracks`,
  untranslated: "Only in English",
};
const portuguese = defineTranslation<typeof source>("pt-BR", (f) => ({
  play: "Tocar",
  tracks: (count: number) => f.plural(count, { one: "# faixa", other: "# faixas" }),
}));

function mapStore(initial: Record<string, string> = {}): LocaleStore & { readonly map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
}

describe("matchLocale", () => {
  it.each([
    ["pt", "pt-BR"],
    ["pt-BR", "pt-BR"],
    ["pt-PT", "pt-BR"],
    ["PT_br", "pt-BR"],
    ["en", "en"],
    ["en-US", "en"],
    ["fr-FR", null],
    ["", null],
  ])("%s -> %s", (tag, expected) => {
    expect(matchLocale(tag)).toBe(expected);
  });
});

describe("resolveLocale", () => {
  it("prefers the saved choice", () => {
    expect(resolveLocale({ saved: "en", host: "pt-BR", navigatorLanguages: ["pt-BR"] })).toBe("en");
  });
  it("then the host page", () => {
    expect(resolveLocale({ saved: null, host: "pt-BR", navigatorLanguages: ["en-US"] })).toBe("pt-BR");
  });
  it("then the first known browser language", () => {
    expect(resolveLocale({ saved: null, host: null, navigatorLanguages: ["de", "pt-PT", "en"] })).toBe("pt-BR");
  });
  it("ignores unknown values and ends in English", () => {
    expect(resolveLocale({ saved: "xx", host: "klingon", navigatorLanguages: ["de"] })).toBe("en");
  });
});

describe("formatters", () => {
  it("picks plural forms by Intl.PluralRules: pt-BR 0 is one, en 0 is other", () => {
    expect(createFormatters("pt-BR").plural(0, { one: "# faixa", other: "# faixas" })).toBe("0 faixa");
    expect(createFormatters("en").plural(0, { one: "# track", other: "# tracks" })).toBe("0 tracks");
    expect(createFormatters("en").plural(1, { one: "# track", other: "# tracks" })).toBe("1 track");
  });
  it("formats numbers and lists in the locale", () => {
    expect(createFormatters("pt-BR").number(65536)).toBe("65.536");
    expect(createFormatters("en").number(65536)).toBe("65,536");
    expect(createFormatters("pt-BR").list(["a", "b", "c"])).toBe("a, b e c");
    expect(createFormatters("en").list(["a", "b", "c"])).toBe("a, b, and c");
  });
});

describe("bindCatalog", () => {
  it("reads the current locale on every access and falls back to English per key", () => {
    const translator = createTranslator("en");
    const live = bindCatalog(translator, source, [portuguese]);
    expect(live.play).toBe("Play");
    translator.setLocale("pt-BR");
    expect(live.play).toBe("Tocar");
    expect(live.tracks(2)).toBe("2 faixas");
    expect(live.untranslated).toBe("Only in English");
  });

  it("follows a translation added after binding, as a language loaded on demand", () => {
    const translator = createTranslator("pt-BR");
    const translations: (typeof portuguese)[] = [];
    const live = bindCatalog(translator, source, translations);
    expect(live.play).toBe("Play");
    translations.push(portuguese);
    expect(live.play).toBe("Tocar");
  });
  it("falls back to English when a translation throws", () => {
    const broken = defineTranslation<typeof source>("pt-BR", () => ({
      tracks: () => {
        throw new Error("bad argument");
      },
    }));
    const live = bindCatalog(createTranslator("pt-BR"), source, [broken]);
    expect(live.tracks(3)).toBe("3 tracks");
  });

  it("messagesOf returns readers that follow the locale", () => {
    const translator = createTranslator("en");
    const text = messagesOf(bindCatalog(translator, source, [portuguese]));
    const play = text.play;
    const tracks = text.tracks(1);
    translator.setLocale("pt-BR");
    expect(play()).toBe("Tocar");
    expect(tracks()).toBe("1 faixa");
  });

  it("referenced keeps the key, the arguments and the English text", () => {
    expect(referenced(source).tracks(4)).toEqual({ key: "tracks", args: [4], text: "4 tracks" });
    expect(referenced(source).play()).toEqual({ key: "play", args: [], text: "Play" });
  });
});

describe("translators", () => {
  it("notifies on change and stops after unsubscribe", () => {
    const translator = createTranslator("en");
    const seen: string[] = [];
    const stop = translator.onChange((locale) => seen.push(locale));
    translator.setLocale("pt-BR");
    translator.setLocale("pt-BR");
    stop();
    translator.setLocale("en");
    expect(seen).toEqual(["pt-BR"]);
  });

  it("a slot answers in English before install and follows the installed translator after", () => {
    const slot = createTranslatorSlot();
    expect(slot.locale()).toBe("en");
    const seen: string[] = [];
    slot.onChange((locale) => seen.push(locale));
    const real = createTranslator("pt-BR");
    slot.install(real);
    real.setLocale("en");
    expect(seen).toEqual(["pt-BR", "en"]);
    expect(slot.locale()).toBe("en");
  });
});

describe("switch", () => {
  it("lists Português then English, endonyms, the current one marked", () => {
    const model = switchModel("en", (locale) => (locale === "en" ? "en/" : "./"));
    expect(model.map((item) => [item.label, item.lang, item.current, item.href])).toEqual([
      ["Português", "pt-BR", false, "./"],
      ["English", "en", true, "en/"],
    ]);
  });

  it("renders escaped links with lang, hreflang and aria-current", () => {
    const html = renderSwitchHtml(switchModel("pt-BR", () => 'a"b'), { group: "Idioma" });
    expect(html).toContain('aria-label="Idioma"');
    expect(html).toContain('href="a&quot;b"');
    expect(html).toContain('lang="pt-BR" hreflang="pt-BR" data-locale-link="pt-BR" aria-current="true">Português</a>');
  });
});

describe("saved choice", () => {
  it("round-trips through the store and ignores unknown values", () => {
    const store = mapStore();
    saveLocale(store, "pt-BR");
    expect(readSavedLocale(store)).toBe("pt-BR");
    expect(readSavedLocale(mapStore({ "untzel.locale": "fr" }))).toBeNull();
    expect(readSavedLocale(null)).toBeNull();
  });

  it("survives a throwing store", () => {
    const throwing: LocaleStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readSavedLocale(throwing)).toBeNull();
    expect(() => saveLocale(throwing, "en")).not.toThrow();
  });

  it("enhanceLanguageLinks carries the hash and saves the choice on click", () => {
    const listeners: (() => void)[] = [];
    const link = {
      dataset: { localeLink: "en" },
      hash: "",
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    };
    const root = { querySelectorAll: () => [link] } as unknown as ParentNode;
    const store = mapStore();
    enhanceLanguageLinks(root, store, () => "#signals");
    listeners.forEach((listener) => listener());
    expect(link.hash).toBe("#signals");
    expect(store.map.get("untzel.locale")).toBe("en");
  });
});
