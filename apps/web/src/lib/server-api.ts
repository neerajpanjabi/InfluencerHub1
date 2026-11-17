import 'server-only';
import { cookies } from 'next/headers';

const API = process.env.API_INTERNAL_URL || 'http://localhost:4000';

/** Server-side fetch for SSR of public pages. Forwards the access cookie so viewer state renders. */
export async function serverApi<T = any>(path: string, opts: { revalidate?: number; auth?: boolean } = {}): Promise<T | null> {
  const headers: Record<string, string> = {};
  if (opts.auth) {
    const at = (await cookies()).get('ih_at')?.value;
    if (at) headers.cookie = `ih_at=${at}`;
  }
  try {
    const res = await fetch(`${API}/api/v1${path}`, { headers, ...(opts.auth ? { cache: 'no-store' } : { next: { revalidate: opts.revalidate ?? 60 } }) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
