import { NextRequest, NextResponse } from "next/server";

import {
  buildCookieOptions,
  encodeGithubOauthState,
  GITHUB_OAUTH_COOKIE,
} from "@/lib/server/auth";
import { buildGithubAuthorizeUrl, createGithubOauthState, getGithubOauthConfig } from "@/lib/server/github-oauth";

export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next");
  const safeNext = next && next.startsWith("/") ? next : "/";
  const config = getGithubOauthConfig(request.nextUrl.origin);

  if (!config) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent("GitHub OAuth not configured")}&next=${encodeURIComponent(safeNext)}`, request.url));
  }

  const state = createGithubOauthState();
  const response = NextResponse.redirect(buildGithubAuthorizeUrl(config, state));
  response.cookies.set(GITHUB_OAUTH_COOKIE, encodeGithubOauthState({ state, next: safeNext }), buildCookieOptions(new Date(Date.now() + 1000 * 60 * 10)));
  return response;
}
