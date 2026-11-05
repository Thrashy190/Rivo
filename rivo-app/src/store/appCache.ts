/**
 * Module-level in-memory cache.
 * Lives outside React — survives navigation, wiped only on full page reload.
 *
 * Usage:
 *   export const myCache = makeCache<MyType[]>();
 *   myCache.set(data);          // store
 *   myCache.peek()              // sync read (undefined if empty)
 *   myCache.isEmpty()           // never been populated
 *   myCache.isStale()           // populated but older than TTL
 *   myCache.invalidate()        // force next fetch to re-populate
 */

const DEFAULT_TTL = 5 * 60_000; // 5 minutes

interface Entry<T> {
  data: T;
  at:   number;
}

export interface AppCache<T> {
  peek(): T | undefined;
  isEmpty(): boolean;
  isStale(): boolean;
  set(data: T): void;
  invalidate(): void;
}

export function makeCache<T>(ttl = DEFAULT_TTL): AppCache<T> {
  let entry: Entry<T> | null = null;

  return {
    peek()        { return entry?.data; },
    isEmpty()     { return entry === null; },
    isStale()     { return !entry || Date.now() - entry.at > ttl; },
    set(data)     { entry = { data, at: Date.now() }; },
    invalidate()  { entry = null; },
  };
}
