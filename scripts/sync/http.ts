/**
 * Small fetch wrapper shared by every source client:
 * - per-host minimum spacing between requests (each API has its own rate limit)
 * - retries with backoff on 429 / 5xx / network errors, honouring Retry-After
 * - a descriptive User-Agent (MangaDex requires one)
 */

const USER_AGENT = 'ShelfTrack-CatalogSync/1.0 (+https://github.com/rohitaryan2211/ShelfTrack)'

const lastRequestAt = new Map<string, number>()

export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export interface FetchJsonOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  /** Minimum milliseconds between two requests to the same host. */
  minIntervalMs?: number
  retries?: number
  /** Return null instead of throwing on 404. */
  allow404?: boolean
}

export class HttpError extends Error {
  constructor(public status: number, url: string, detail: string) {
    super(`HTTP ${status} for ${url}: ${detail.slice(0, 200)}`)
  }
}

async function throttle(host: string, minIntervalMs: number) {
  const last = lastRequestAt.get(host) ?? 0
  const wait = last + minIntervalMs - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequestAt.set(host, Date.now())
}

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T | null> {
  const { method = 'GET', body, minIntervalMs = 250, retries = 4, allow404 = false } = opts
  const host = new URL(url).host

  for (let attempt = 0; ; attempt++) {
    await throttle(host, minIntervalMs)
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
      })
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(1000 * 2 ** attempt)
      continue
    }

    if (res.ok) return (await res.json()) as T
    if (res.status === 404 && allow404) return null

    const retryable = res.status === 429 || res.status >= 500
    if (!retryable || attempt >= retries) {
      throw new HttpError(res.status, url, await res.text().catch(() => ''))
    }
    const retryAfter = Number(res.headers.get('retry-after'))
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt
    await sleep(Math.min(backoff, 90_000))
  }
}
