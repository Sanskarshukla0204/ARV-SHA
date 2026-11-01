/** Runs a data load and returns a fallback if it throws, so one failing query shows an empty state instead of a crashed page. */
export async function safe<T>(job: Promise<T>, fallback: T, label = 'page data'): Promise<T> {
  try {
    return await job;
  } catch (err) {
    console.error(`[page] could not load ${label}:`, (err as Error).message);
    return fallback;
  }
}

export function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function many(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : [v]).map((s) => s.trim()).filter(Boolean).slice(0, 20);
}
