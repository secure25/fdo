import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dos_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  // App area requires a session cookie (full validation happens server-side).
  if (pathname.startsWith("/app") || pathname.startsWith("/onboarding")) {
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if ((pathname === "/login" || pathname === "/signup") && hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/app";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login", "/signup"],
};
