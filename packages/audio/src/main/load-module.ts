// SPDX-License-Identifier: CPAL-1.0
// Copyright (c) 2026 Techno Inspire. See LICENSE and ATTRIBUTION.md.

/**
 * compileStreaming(fetch(url)); on a TypeError (wrong MIME type) fetches again and uses
 * WebAssembly.compile(arrayBuffer), once. A failed fetch rejects: the caller shows Retry.
 * `started` is that compileStreaming begun earlier on the same URL (preloadAudio).
 */
export async function compileDsp(url: string, started?: Promise<WebAssembly.Module>): Promise<WebAssembly.Module> {
  try {
    return await (started ?? WebAssembly.compileStreaming(fetchOk(url)));
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const response = await fetchOk(url);
    return WebAssembly.compile(await response.arrayBuffer());
  }
}

async function fetchOk(url: string): Promise<Response> {
  return checked(await fetch(url), url);
}

function checked(response: Response, url: string): Response {
  if (!response.ok) throw new Error(`Untzel DSP fetch failed: ${response.status} ${url}`);
  return response;
}
