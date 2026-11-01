/** Complete JSON verification, including a bounded retry after a page-owned read is interrupted. */
export async function readJsonArtifact(response) {
  const url = response.url();
  let text = '', transportRetry = false, originalReadError;
  try {
    // The partial header map omits browser cookies; capture complete on-wire headers before teardown.
    const headers = { ...(await response.request().allHeaders()) };
    try {
      if (response.status() === 304) throw new Error('Conditional response has no complete document body');
      text = await response.text();
    } catch (error) {
      transportRetry = true;
      originalReadError = String(error);
      // Request the full original document, retaining credentials but not cache/range preconditions.
      for (const name of Object.keys(headers)) {
        if (['if-none-match', 'if-modified-since', 'range', 'if-range', 'content-length', 'host', 'connection'].includes(name.toLowerCase())) delete headers[name];
      }
      const retry = await fetch(url, { headers, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) });
      if (!retry.ok) throw new Error(`Complete artifact GET answered HTTP ${retry.status}`);
      text = await retry.text();
    }
    const first = text.trimStart().slice(0, 1);
    const value = JSON.parse(text);
    if (value === null || typeof value !== 'object') throw new Error('Artifact must be a JSON object or array');
    return { ok: true, first, transportRetry, ...(originalReadError ? { originalReadError } : {}) };
  } catch (error) {
    return { ok: false, first: text.trimStart().slice(0, 1), transportRetry, error: String(error), ...(originalReadError ? { originalReadError } : {}) };
  }
}
