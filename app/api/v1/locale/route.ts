import { NextRequest, NextResponse } from "next/server";

import { localeCookieName } from "@/lib/i18n";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";
  const response = NextResponse.redirect(new URL(safeNext, request.url));

  if (locale === "en" || locale === "zh") {
    response.cookies.set(localeCookieName, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
