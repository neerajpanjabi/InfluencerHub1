'use client';

export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: any) {
    super(code);
  }
}

function csrfToken(): string {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|; )ih_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

let refreshing: Promise<boolean> | null = null;
async function tryRefresh() {
  refreshing ??= fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'x-csrf-token': csrfToken() } })
    .then((r) => r.ok)
    .finally(() => setTimeout(() => (refreshing = null), 0));
  return refreshing;
}

/** Browser API client: same-origin, cookie auth, CSRF header, transparent access-token refresh. */
export async function api<T = any>(path: string, init: { method?: string; body?: unknown; form?: FormData } = {}, retried = false): Promise<T> {
  const method = init.method ?? (init.body || init.form ? 'POST' : 'GET');
  const headers: Record<string, string> = {};
  if (method !== 'GET') headers['x-csrf-token'] = csrfToken();
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, { method, headers, credentials: 'include', body: init.form ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined) });
  if (res.status === 401 && !retried && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh')) {
    if (await tryRefresh()) return api<T>(path, init, true);
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'ERROR', data);
  return data as T;
}

export const newIdempotencyKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
