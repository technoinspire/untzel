// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Markdown to HTML with markdown-it (html, linkify and typographer off) and five rules of
// our own: explicit heading ids, block directives, the inline {{limit}}, internal links
// and table alignment as classes (CSP: no style attribute).
import MarkdownItClass, { type MarkdownIt, type StateBlock, type StateCore, type StateInline, type Token } from "markdown-it";
import { isPageId } from "../../../../apps/docs/src/pages";
import type { RenderContext } from "../content/context";
import { DIRECTIVE_LINE, DIRECTIVES, INLINE_DIRECTIVES } from "../directives/index";
import { labelValue } from "../directives/app";
import { limitValue } from "../directives/language";
import { DirectiveError } from "../directives/types";
import { pagePath, relativeHref } from "../content/site";

export interface Heading {
  readonly level: number;
  readonly id: string;
  readonly text: string;
  readonly line: number;
}

export interface DirectiveUse {
  readonly name: string;
  readonly argument: string | null;
}

/** What one render collects besides the HTML. */
export interface PageEnv {
  readonly context: RenderContext;
  readonly headings: Heading[];
  readonly directives: DirectiveUse[];
}

const HEADING_ID = /\s*\{#([a-z0-9][a-z0-9-]*)\}$/;
const PAGE_LINK = /^([a-z-]+)\.md(#[a-z0-9-]+)?$/;
const ANCHOR = /^#[a-z0-9-]+$/;

function pageEnv(env: unknown): PageEnv {
  return (env as { page: PageEnv }).page;
}

/** line is the 0-based source line; null when markdown-it does not know it (inline rules). */
function fail(env: PageEnv, line: number | null | undefined, message: string): void {
  env.context.errors.push(line === null ? `${env.context.file}: ${message}` : `${env.context.file}:${(line ?? 0) + 1}: ${message}`);
}

function directiveBlock(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const line = state.src.slice(state.bMarks[startLine]! + state.tShift[startLine]!, state.eMarks[startLine]);
  const match = DIRECTIVE_LINE.exec(line);
  if (match === null || INLINE_DIRECTIVES.has(match[1] ?? "")) return false;
  if (silent) return true;
  const token = state.push("directive", "", 0);
  token.meta = { name: match[1], argument: match[2] ?? null };
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function inlineLimit(state: StateInline, silent: boolean): boolean {
  if (!state.src.startsWith("{{limit ", state.pos) && !state.src.startsWith("{{label ", state.pos)) return false;
  const match = /^\{\{(limit|label) ([A-Za-z_]+)\}\}/.exec(state.src.slice(state.pos));
  if (match === null) return false;
  if (!silent) {
    const env = pageEnv(state.env);
    const token = state.push("text", "", 0);
    try {
      token.content = match[1] === "label" ? labelValue(match[2] ?? "", env.context) : limitValue(match[2] ?? "", env.context);
    } catch (error) {
      fail(env, null, (error as Error).message);
      token.content = match[0];
    }
  }
  state.pos += match[0].length;
  return true;
}

function headingIds(state: StateCore): void {
  const env = pageEnv(state.env);
  const seen = new Set<string>();
  state.tokens.forEach((token, index) => {
    if (token.type !== "heading_open") return;
    const inline = state.tokens[index + 1];
    const last = inline?.children?.at(-1);
    const match = last?.type === "text" ? HEADING_ID.exec(last.content) : null;
    if (inline === undefined || last === undefined || match === null) {
      fail(env, token.map?.[0], "every heading ends with {#id}");
      return;
    }
    const id = match[1] ?? "";
    last.content = last.content.replace(HEADING_ID, "");
    inline.content = inline.content.replace(HEADING_ID, "");
    if (seen.has(id)) fail(env, token.map?.[0], `heading id "${id}" is repeated`);
    seen.add(id);
    token.attrSet("id", id);
    const text = (inline.children ?? []).map((child) => child.content).join("");
    env.headings.push({ level: Number(token.tag.slice(1)), id, text, line: (token.map?.[0] ?? 0) + 1 });
  });
}

function rewriteLink(token: Token, env: PageEnv, line: number | undefined): void {
  const href = String(token.attrGet("href") ?? "");
  const page = PAGE_LINK.exec(href);
  if (page !== null) {
    const id = page[1] ?? "";
    if (!isPageId(id)) return fail(env, line, `link to unknown page ${href}`);
    token.attrSet("href", relativeHref(env.context.path, pagePath(id, env.context.locale), page[2] ?? ""));
    return;
  }
  if (ANCHOR.test(href)) return;
  if (!href.startsWith("https://")) fail(env, line, `link ${href}: use page.md#id or an https URL`);
}

function links(state: StateCore): void {
  const env = pageEnv(state.env);
  for (const token of state.tokens) {
    if (token.type === "fence" && token.info.trim() === "untzel") fail(env, token.map?.[0], "an untzel fence in a page: use {{example <id>}}");
    for (const child of token.children ?? []) {
      if (child.type === "link_open") rewriteLink(child, env, token.map?.[0]);
    }
  }
}

function renderDirective(tokens: Token[], index: number, _options: unknown, rawEnv: unknown): string {
  const env = pageEnv(rawEnv);
  const token = tokens[index]!;
  const { name, argument } = token.meta as { name: string; argument: string | null };
  env.directives.push({ name, argument });
  const directive = DIRECTIVES[name];
  if (directive === undefined) {
    fail(env, token.map?.[0], `unknown directive {{${name}}}`);
    return "";
  }
  try {
    return `${directive(argument, env.context).html.value}\n`;
  } catch (error) {
    if (!(error instanceof DirectiveError)) throw error;
    fail(env, token.map?.[0], error.message);
    return "";
  }
}

const ALIGN = /^text-align:(left|center|right)$/;

function alignedCell(md: MarkdownIt): (tokens: Token[], index: number, options: never, env: unknown, self: never) => string {
  return (tokens, index, options, _env, self) => {
    const token = tokens[index]!;
    const style = String(token.attrGet("style") ?? "");
    if (token.attrs !== null) token.attrs = token.attrs.filter(([name]) => name !== "style");
    const align = ALIGN.exec(style)?.[1];
    if (align !== undefined) token.attrJoin("class", `align-${align}`);
    return md.renderer.renderToken(tokens, index, options ?? self);
  };
}

export function createMarkdown(): MarkdownIt {
  const md = new MarkdownItClass({ html: false, linkify: false, typographer: false });
  md.block.ruler.before("paragraph", "directive", directiveBlock);
  md.inline.ruler.after("text", "limit", inlineLimit);
  md.core.ruler.after("inline", "heading_ids", headingIds);
  md.core.ruler.after("heading_ids", "links", links);
  md.renderer.rules["directive"] = renderDirective as never;
  md.renderer.rules["th_open"] = alignedCell(md) as never;
  md.renderer.rules["td_open"] = alignedCell(md) as never;
  return md;
}

export interface RenderedPage {
  readonly html: string;
  readonly headings: readonly Heading[];
  readonly directives: readonly DirectiveUse[];
}

export function renderMarkdown(md: MarkdownIt, source: string, context: RenderContext): RenderedPage {
  const page: PageEnv = { context, headings: [], directives: [] };
  const htmlText = md.render(source, { page });
  return { html: htmlText, headings: page.headings, directives: page.directives };
}

