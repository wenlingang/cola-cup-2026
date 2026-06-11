const USER_AGENT = "cup-worldcup/1.0 (internal coke-betting tool)";

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fetch + parse JSON with a User-Agent and exponential backoff on 429 / 5xx.
 * Honours a numeric Retry-After header when present. Throws on non-retryable
 * errors or once retries are exhausted.
 */
export async function fetchJsonRetry<T>(
  url: string,
  init: RequestInit = {},
  options: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelay = options.baseDelayMs ?? 1000;

  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) },
    });
    if (res.ok) return (await res.json()) as T;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelay * 2 ** attempt;
      await sleep(delay);
      continue;
    }
    throw new Error(`Fetch ${res.status} for ${url}`);
  }
}
