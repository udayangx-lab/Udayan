import {NextResponse, type NextRequest} from 'next/server';

// Admin routes that return files or JSON answer 401 themselves rather than redirecting to the login page.
const selfChecking = ['/admin/upload', '/admin/files/', '/admin/export', '/admin/backup'];

// A fast first gate for admin pages. Every admin page, action, and route still verifies the signed session.
export function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;
  if (pathname === '/admin/login' || request.method !== 'GET' || selfChecking.some(path => pathname.startsWith(path)) || request.cookies.has('udayan_admin')) return NextResponse.next();
  return NextResponse.redirect(new URL('/admin/login', request.url));
}

export const config = {matcher: ['/admin', '/admin/:path*']};
