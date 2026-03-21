import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isPathLocale } from "@/lib/locale-routing";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const segments = request.nextUrl.pathname.split("/");
  const maybeLocale = segments[1];

  if (maybeLocale && isPathLocale(maybeLocale)) {
    requestHeaders.set("x-clawlodge-locale", maybeLocale);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
