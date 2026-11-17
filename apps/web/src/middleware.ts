import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);
const PROTECTED = /^\/(en|ar)\/(business|influencer|admin)(\/|$)/;

/**
 * Locale routing + a UX redirect for portal pages when there is no session hint cookie.
 * This is NOT the security boundary — every API call is authorised server-side.
 */
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PROTECTED.test(pathname) && !req.cookies.get('ih_csrf') && !pathname.includes('/admin/login')) {
    const locale = pathname.split('/')[1];
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith(`/${locale}/admin`) ? `/${locale}/admin/login` : `/${locale}/login`;
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return intl(req);
}

export const config = { matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'] };
