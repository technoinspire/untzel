// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Unit tests of the docs generator: the five markdown rules, URLs by depth, escaping of the
// highlighter, the feature probes on this build, the llms files and the output checks.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS } from "@untzel/commands";
import { createFormatters, LOCALES, type Locale } from "@untzel/i18n";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FEATURES } from "../../../apps/docs/src/features";
import { PAGE_IDS } from "../../../apps/docs/src/pages";
import { llmsTxt, PROMPT_HEADING, promptSection } from "./ai/llms";
import { generate, type BuildResult } from "./build";
import { checkForbidden, checkHeadings, checkLinks, checkSnippets, listFiles, untzelFences } from "./checks/output";
import { frameText, type RenderContext } from "./content/context";
import { isDynamicallyImported, memberNames, namedImports } from "./content/features";
import { highlightUntzel } from "./render/highlight";
import { resolveRequest } from "./serve";
import { createMarkdown, renderMarkdown } from "./render/markdown";
import { appHref, APP_URL, DOCS_PATH, pagePath, relativeHref, SITE_ORIGIN } from "./content/site";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));
let built: BuildResult;

beforeAll(async () => {
  built = await generate(REPO);
}, 60_000);

function contextFor(path: string, locale: Locale = "en"): RenderContext {
  return {
    data: built.data,
    locale,
    text: frameText(locale),
    formatters: createFormatters(locale),
    path,
    file: "test.md",
    errors: [],
    examples: [],
    codeIds: [],
  };
}

function render(source: string, path = "en/language/", locale: Locale = "en") {
  const context = contextFor(path, locale);
  const page = renderMarkdown(createMarkdown(), source, context);
  return { ...page, errors: context.errors, examples: context.examples };
}

describe("the generator on this build", () => {
  it("renders every page in every locale without errors", () => {
    expect(built.errors).toEqual([]);
    expect(built.pages).toHaveLength(PAGE_IDS.length * LOCALES.length);
  });
});

describe("pages generated from main's sources", () => {
  const body = (id: string, locale: Locale): string => built.pages.find((page) => page.id === id && page.locale === locale)?.body ?? "";
  it("credit VocalSet on the credits page from credits.json, with its CC BY 4.0 link, in both languages", () => {
    for (const locale of LOCALES) {
      const page = body("credits", locale);
      expect(page, locale).toContain('data-credit="vocalset"');
      expect(page, locale).toContain('href="https://creativecommons.org/licenses/by/4.0/"');
      expect(page, locale).toContain("Wilkins");
    }
    expect(body("credits", "pt-BR")).toContain("Licença");
  });
  it("credit the recorded instruments: CC BY 3.0 with its credit line, CC0 without one, no empty DOI", () => {
    for (const locale of LOCALES) {
      const page = body("credits", locale);
      for (const id of ["salamander", "vsco-2-ce", "vcsl"]) expect(page, `${locale} ${id}`).toContain(`data-credit="${id}"`);
      expect(page, locale).toContain('href="https://creativecommons.org/licenses/by/3.0/"');
      expect(page, locale).toContain("Alexander Holm, licensed under CC BY 3.0");
      expect(page, locale).not.toContain("doi.org/null");
    }
  });
  it("show each instrument's model name next to the language word", () => {
    expect(body("instruments", "en")).toContain("<dt>Model</dt><dd>AURA Grand</dd>");
    expect(body("instruments", "pt-BR")).toContain("<dt>Modelo</dt><dd>VOLTA K9</dd>");
  });
  it("list every template of the library with its style, and the first-touch one on the start page", () => {
    const app = body("app", "en");
    for (const template of built.data.sources.templates) expect(app, template.id).toContain(template.name);
    const first = built.data.sources.templates.find((template) => template.id === built.data.sources.firstTouch);
    expect(first).toBeDefined();
    expect(body("start", "en")).toContain(first?.name ?? "");
    // The key as the text, the transport and the cards write it, in every language.
    expect(body("app", "pt-BR")).toMatch(/<td>[a-g][#b]? (minor|major|dorian|phrygian)<\/td>/);
  });
  it("describe the instruments and their sounds in the page's language", () => {
    expect(body("instruments", "en")).toContain('data-sound="choir/ooh"');
    expect(body("instruments", "pt-BR")).toContain("Coral de cantores gravados");
    expect(body("app", "en")).not.toMatch(/\bRec\b/);
  });
  it("list every command of the Code panel's command line, the summary in the page's language", () => {
    for (const command of COMMANDS) {
      expect(body("app", "en"), command.name).toContain(`<code>${command.example}</code>`);
      expect(body("app", "pt-BR"), command.name).toContain(`<code>${command.example}</code>`);
    }
    expect(body("app", "en")).toContain("<td>turn a track off on the next bar</td>");
    expect(body("app", "pt-BR")).toContain("<td>desliga uma faixa no próximo compasso</td>");
    expect(body("app", "en")).toContain('data-feature="composer-terminal" data-state="available"');
  });
  // The copy rule: a feature this build lacks is "Planned", never "soon".
  it("mark a feature the probe does not find as planned, in both languages", () => {
    const features = new Map(built.data.features);
    features.set("chords", false);
    for (const [locale, label] of [["en", "Planned"], ["pt-BR", "Planejado"]] as const) {
      const context = { ...contextFor("en/app/", locale), data: { ...built.data, features } };
      const html = renderMarkdown(createMarkdown(), "{{status chords}}", context).html;
      expect(html).toContain('<span class="status status--planned" data-feature="chords" data-state="planned">');
      expect(html).toContain(`<span>${label}</span>`);
      expect(html).not.toMatch(/soon|em breve/i);
    }
  });
  it("say which keys the Code editor keeps: undo works there too, Mod+. fixes there instead of stopping", () => {
    const app = body("app", "en");
    expect(app).toMatch(/<tr data-shortcut="undo">.*?<td>anywhere, also in the editor<\/td><\/tr>/);
    expect(app).toMatch(/<tr data-shortcut="stop"><th scope="row"><kbd>Mod\+\.<\/kbd>.*?<td>outside the code editor<\/td><\/tr>/);
  });
});

describe("heading ids", () => {
  it("takes the explicit id and removes it from the text", () => {
    const page = render("# Signals {#signals}\n");
    expect(page.html).toContain('<h1 id="signals">Signals</h1>');
    expect(page.headings).toEqual([{ level: 1, id: "signals", text: "Signals", line: 1 }]);
    expect(page.errors).toEqual([]);
  });

  it("rejects a heading without an id and a repeated id", () => {
    expect(render("# Signals\n").errors).toEqual(["test.md:1: every heading ends with {#id}"]);
    expect(render("# A {#a}\n\n## B {#a}\n").errors).toEqual(['test.md:3: heading id "a" is repeated']);
  });
});

describe("app labels", () => {
  it("show the label the app shows in the page's language", () => {
    expect(render("# A {#a}\n\nTap **{{label tapToPlay}}**.\n").html).toContain("<strong>Tap to play</strong>");
    expect(render("# A {#a}\n\nToque em **{{label tapToPlay}}**.\n", "language/", "pt-BR").html).toContain("<strong>Toque para tocar</strong>");
  });
  it("reject a key that is not a text label of the app", () => {
    expect(render("# A {#a}\n\n{{label barOf}} and {{label nothing}}\n").errors).toHaveLength(2);
  });
});
describe("directives", () => {
  it("includes an example, highlighted, and records it", () => {
    const page = render("# T {#t}\n\n{{example first-loop}}\n");
    expect(page.errors).toEqual([]);
    expect(page.examples).toEqual(["first-loop"]);
    expect(page.html).toContain('<pre class="untzel"');
    expect(page.html).toContain('class="tok-keyword"');
  });

  it("fails on an unknown directive, example or limit", () => {
    expect(render("# T {#t}\n\n{{nothing}}\n").errors).toEqual(["test.md:3: unknown directive {{nothing}}"]);
    expect(render("# T {#t}\n\n{{example missing-one}}\n").errors[0]).toMatch(/^test\.md:3: .*missing-one/);
    expect(render("# T {#t}\n\nUp to {{limit NO_SUCH_LIMIT}} bars.\n").errors).toEqual(["test.md: unknown limit NO_SUCH_LIMIT"]);
  });

  it("writes a limit inline with the separator of the locale", () => {
    expect(render("# T {#t}\n\nUp to {{limit MAX_PART_BARS}} bars.\n").html).toContain("Up to 256 bars.");
    expect(render("# T {#t}\n\n{{limit MAX_SOURCE_LENGTH}}\n").html).toContain("65,536");
    expect(render("# T {#t}\n\n{{limit MAX_SOURCE_LENGTH}}\n", "language/", "pt-BR").html).toContain("65.536");
  });

  it("refuses an untzel fence in a page: code enters only by {{example}}", () => {
    expect(render("# T {#t}\n\n```untzel\ntempo 124\n```\n").errors).toEqual(["test.md:3: an untzel fence in a page: use {{example <id>}}"]);
    expect(render("# T {#t}\n\n```sh\npnpm check\n```\n").errors).toEqual([]);
  });
});

describe("links", () => {
  it("rewrites a page link to the same locale, relative to the depth", () => {
    expect(render("# T {#t}\n\n[s](language.md#signals)\n", "en/").html).toContain('href="../en/language/#signals"');
    expect(render("# T {#t}\n\n[s](language.md#signals)\n", "", "pt-BR").html).toContain('href="./language/#signals"');
    expect(render("# T {#t}\n\n[s](start.md)\n", "en/language/").html).toContain('href="../../en/"');
  });

  it("rejects unknown pages and http, and accepts a link to the repository", () => {
    expect(render("# T {#t}\n\n[x](nowhere.md)\n").errors).toEqual(["test.md:3: link to unknown page nowhere.md"]);
    expect(render("# T {#t}\n\n[x](http://example.com)\n").errors[0]).toContain("use page.md#id or an https URL");
    expect(render("# T {#t}\n\n[x](https://github.com/technoinspire/untzel)\n").errors).toEqual([]);
  });

  it("links every page to the app on its own origin, app.untzel.com", () => {
    expect(APP_URL).toBe("https://app.untzel.com/");
    for (const locale of LOCALES) {
      for (const id of PAGE_IDS) {
        const path = pagePath(id, locale);
        expect(new URL(appHref(), `${SITE_ORIGIN}${DOCS_PATH}${path}`).href).toBe(APP_URL);
      }
    }
  });

  it("resolves every relative page link inside the docs", () => {
    for (const from of LOCALES.flatMap((locale) => PAGE_IDS.map((id) => pagePath(id, locale)))) {
      for (const to of LOCALES.flatMap((locale) => PAGE_IDS.map((id) => pagePath(id, locale)))) {
        expect(new URL(relativeHref(from, to), `${SITE_ORIGIN}${DOCS_PATH}${from}`).pathname).toBe(`${DOCS_PATH}${to}`);
      }
    }
  });
});

describe("table alignment", () => {
  it("moves text-align into a class and never writes a style attribute", () => {
    const page = render("# T {#t}\n\n| a | b | c |\n|:--|:-:|--:|\n| 1 | 2 | 3 |\n");
    expect(page.html).not.toContain("style=");
    expect(page.html).toContain('<th class="align-left">a</th>');
    expect(page.html).toContain('<td class="align-center">2</td>');
    expect(page.html).toContain('<td class="align-right">3</td>');
  });
});

describe("highlighting", () => {
  it("escapes every character of the source, comments included", () => {
    const out = highlightUntzel('// a <b> & "c"\nkick: kick x...').value;
    expect(out).not.toMatch(/<b>|& |"c"/);
    expect(out).toContain("&lt;b&gt; &amp; &quot;c&quot;");
    expect(out.replace(/<[^>]*>/g, "")).toBe("// a &lt;b&gt; &amp; &quot;c&quot;\nkick: kick x...");
  });
});

describe("feature probes", () => {
  it("are true for everything the app has, the export loaded on demand included", () => {
    for (const feature of FEATURES) expect(built.data.features.get(feature.id), feature.id).toBe(true);
  });
  it("see a package the app loads with import(): the names read off the loaded module count", () => {
    expect(isDynamicallyImported('load: () => import("@untzel/export"),', "@untzel/export")).toBe(true);
    expect(isDynamicallyImported('import { x } from "@untzel/export";', "@untzel/export")).toBe(false);
    expect([...memberNames("const client = new api.ExportClient(url); api.chooseTiers(probe);")]).toEqual(expect.arrayContaining(["ExportClient", "chooseTiers"]));
  });

  it("read only value imports from the named package", () => {
    const source = [
      'import { encodeLink, decodeFragment as decode } from "@untzel/share";',
      'import type { Session } from "@untzel/share";',
      'import { type LocalSessionStore, other } from "@untzel/share";',
      'import { ExportClient } from "@untzel/export";',
    ].join("\n");
    expect([...namedImports(source, "@untzel/share")].sort()).toEqual(["decodeFragment", "encodeLink", "other"]);
  });
});

describe("llms files", () => {
  it("writes llms.txt in the llmstxt.org shape from page summaries", () => {
    const text = llmsTxt([{ id: "language", title: "Language guide", description: "How to write Untzel." }]);
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines[0]).toBe("# Untzel");
    expect(lines[1]).toMatch(/^> /);
    expect(lines).toContain("## Docs");
    expect(lines).toContain("## Reference");
    expect(lines).toContain("## Optional");
    expect(text).toContain("- [Language guide](https://untzel.com/docs/en/language/): How to write Untzel.");
    expect(text).toContain("- [Full reference for language models](https://untzel.com/docs/llms-full.txt)");
  });

  it("ends llms-full.txt with the prompt, read back exactly", () => {
    expect(built.llmsFull).toContain(`\n${PROMPT_HEADING}\n`);
    expect(promptSection(built.llmsFull)).toBe(built.data.prompt);
  });

  it("keeps the committed llms files equal to a fresh generation", () => {
    expect(readFileSync(join(REPO, "apps/docs/generated/llms.txt"), "utf8")).toBe(built.llms);
    expect(readFileSync(join(REPO, "apps/docs/generated/llms-full.txt"), "utf8")).toBe(built.llmsFull);
  });

  it("has no Untzel literal in tools/docs/src/ai", () => {
    const folder = fileURLToPath(new URL("./ai/", import.meta.url));
    for (const file of readdirSync(folder)) {
      expect(readFileSync(join(folder, file), "utf8"), file).not.toContain("```untzel");
    }
  });
});

describe("output checks", () => {
  let root: string;
  const put = (file: string, text: string): void => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "untzel-docs-test-"));
    put("index.html", '<h1 id="top">A</h1><a href="./language/#signals">ok</a><a href="./language/#gone">broken</a><a href="./missing/">missing</a>');
    put("language/index.html", '<h1 id="language">L</h1><h2 id="signals">S</h2><a href="../#top">back</a>');
    // A sibling folder that shares the root's prefix: never served.
    mkdirSync(`${root}-other`, { recursive: true });
    writeFileSync(join(`${root}-other`, "x"), "secret");
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(`${root}-other`, { recursive: true, force: true });
  });

  it("catches a broken anchor and a missing page, and nothing else", () => {
    expect(checkLinks(root, listFiles(root))).toEqual([
      'index.html: ./language/#gone → no id "gone" in language/index.html',
      "index.html: ./missing/ → missing/index.html does not exist",
    ]);
  });

  it("forbids a data: URL that loads something, not the words, and accepts a link to the repository", () => {
    const folder = mkdtempSync(join(tmpdir(), "untzel-docs-forbidden-"));
    try {
      writeFileSync(join(folder, "quoted.html"), "<pre>img-src 'self' data: blob:</pre><a href=\"https://github.com/sgossner/VCSL\">VCSL</a>");
      writeFileSync(join(folder, "loads.html"), '<img src="data:image/png;base64,AA"><a href="https://github.com/technoinspire/untzel">repo</a>');
      expect(checkForbidden(folder, ["quoted.html", "loads.html"])).toEqual(["loads.html: a data: URL"]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
  it("catches a skipped heading level and a second h1", () => {
    expect(checkHeadings("a.html", "<h1>a</h1><h3>b</h3>")).toEqual(["a.html: h3 after h1 skips a level"]);
    expect(checkHeadings("a.html", "<h1>a</h1><h1>b</h1>")).toEqual(["a.html: needs exactly one h1"]);
  });

  it("accepts an error example byte for byte and rejects any other broken snippet", () => {
    const sources = built.data.sources;
    const errorExample = sources.examples.get("errors/UNKNOWN_INSTRUMENT")?.text ?? "";
    expect(checkSnippets("x", [errorExample], sources)).toEqual([]);
    expect(checkSnippets("x", [`${errorExample}\n`], sources)).toHaveLength(1);
    expect(checkSnippets("x", ["kick: kick x..."], sources)).toEqual([]);
  });

  it("serves only below the docs root, with a redirect to the trailing slash", () => {
    expect(resolveRequest(root, "/docs/")).toEqual({ file: join(root, "index.html") });
    expect(resolveRequest(root, "/docs/language")).toEqual({ redirect: "/docs/language/" });
    expect(resolveRequest(root, "/docs/nothing/")).toBeNull();
    expect(resolveRequest(root, "/docs/../untzel-docs-secret.txt")).toBeNull();
    expect(resolveRequest(root, `/docs/..%2F${root.split("/").at(-1)}-other/x`)).toBeNull();
    expect(resolveRequest(root, "/")).toBeNull();
  });

  it("finds untzel fences in text", () => {
    expect(untzelFences("a\n```untzel\ntempo 124\nkick: kick x...\n```\nb\n```text\nno\n```\n")).toEqual(["tempo 124\nkick: kick x..."]);
  });
});
