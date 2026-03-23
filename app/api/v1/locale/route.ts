import { NextRequest, NextResponse } from "next/server";

import { localeCookieName } from "@/lib/i18n";
import { siteConfig } from "@/lib/site";

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get("locale");
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const origin = forwardedProto && forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : siteConfig.origin;
  const response = NextResponse.redirect(new URL(safeNext, origin));

  if (locale === "en" || locale === "zh" || locale === "ja" || locale === "fr") {
    response.cookies.set(localeCookieName, locale, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}
