import { NextRequest, NextResponse } from "next/server";

import {
  buildCookieOptions,
  buildExpiredCookieOptions,
  createSessionForUser,
  decodeGithubOauthState,
  GITHUB_OAUTH_COOKIE,
  SESSION_COOKIE,
} from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { exchangeGithubCode, fetchGithubUserProfile, getGithubOauthConfig } from "@/lib/server/github-oauth";
import { findOrCreateGithubUser } from "@/lib/server/service";

function errorRedirect(request: NextRequest, message: string, nextPath: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(nextPath)}`, request.url),
  );
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthCookie = request.cookies.get(GITHUB_OAUTH_COOKIE)?.value;
  const oauthState = decodeGithubOauthState(oauthCookie);
  const nextPath = oauthState?.next ?? "/";

  if (!code || !state || !oauthState || oauthState.state !== state) {
    const response = errorRedirect(request, "GitHub login state mismatch", nextPath);
    response.cookies.set(GITHUB_OAUTH_COOKIE, "", buildExpiredCookieOptions());
    return response;
  }

  const config = getGithubOauthConfig(request.nextUrl.origin);
  if (!config) {
    const response = errorRedirect(request, "GitHub OAuth not configured", nextPath);
    response.cookies.set(GITHUB_OAUTH_COOKIE, "", buildExpiredCookieOptions());
    return response;
  }

  try {
    const accessToken = await exchangeGithubCode(config, code);
    const profile = await fetchGithubUserProfile(accessToken);
    const user = await findOrCreateGithubUser({
      githubId: String(profile.id),
      login: profile.login,
      name: profile.name,
      avatarUrl: profile.avatar_url,
      bio: profile.bio,
      email: profile.email,
    });
    const session = await createSessionForUser(user.id);

    const response = NextResponse.redirect(new URL(nextPath, request.url));
    response.cookies.set(SESSION_COOKIE, session.token, buildCookieOptions(session.expiresAt));
    response.cookies.set(GITHUB_OAUTH_COOKIE, "", buildExpiredCookieOptions());
    return response;
  } catch (error) {
    const message = error instanceof ApiError ? error.message : "GitHub login failed";
    const response = errorRedirect(request, message, nextPath);
    response.cookies.set(GITHUB_OAUTH_COOKIE, "", buildExpiredCookieOptions());
    return response;
  }
}
