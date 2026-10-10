// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.
// Search over the static index of this language. Results are written with textContent,
// never as HTML; the query is at most 100 characters, trimmed, lower case, without accents.

interface Entry {
  readonly t: string;
  readonly p: string;
  readonly s: string;
}

const MAX_QUERY = 100;
const MAX_RESULTS = 8;

export function normalize(text: string): string {
  return text
    .slice(0, MAX_QUERY)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matches(entries: readonly Entry[], query: string): readonly Entry[] {
  const words = normalize(query).split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return [];
  return entries
    .filter((entry) => {
      const haystack = normalize(`${entry.t} ${entry.s}`);
      return words.every((word) => haystack.includes(word));
    })
    .slice(0, MAX_RESULTS);
}

function message(list: HTMLUListElement, text: string): void {
  const item = document.createElement("li");
  item.className = "search__message";
  item.textContent = text;
  list.replaceChildren(item);
}

function show(list: HTMLUListElement, root: string, found: readonly Entry[], empty: string): void {
  if (found.length === 0) return message(list, empty);
  list.replaceChildren(
    ...found.map((entry) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `${root}${entry.p}`;
      link.textContent = entry.t;
      item.append(link);
      return item;
    }),
  );
}

export function setupSearch(container: HTMLElement | null): void {
  if (container === null) return;
  const input = container.querySelector<HTMLInputElement>("input");
  const list = container.querySelector<HTMLUListElement>("ul");
  if (input === null || list === null) return;
  container.hidden = false;
  const { index = "", root = "", unavailable = "", empty = "" } = container.dataset;
  let entries: readonly Entry[] | null = null;
  const load = async (): Promise<readonly Entry[] | null> => {
    if (entries !== null) return entries;
    try {
      const response = await fetch(index);
      if (!response.ok) throw new Error(String(response.status));
      entries = (await response.json()) as Entry[];
      return entries;
    } catch {
      console.info("docs: the search index could not be loaded");
      return null;
    }
  };
  input.addEventListener("input", () => {
    void load().then((loaded) => {
      if (loaded === null) return message(list, unavailable);
      if (normalize(input.value) === "") return list.replaceChildren();
      show(list, root, matches(loaded, input.value), empty);
    });
  });
}
