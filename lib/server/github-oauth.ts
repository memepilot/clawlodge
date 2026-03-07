import { ApiError } from "./errors";
import { generateSessionToken } from "./utils";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_API_URL = "https://api.github.com";

export type GithubUserProfile = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  bio: string | null;
  email: string | null;
};

type GithubEmailRecord = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export function getGithubOauthConfig(requestOrigin?: string) {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  const appOrigin = process.env.APP_ORIGIN?.trim() || requestOrigin?.trim();

  if (!clientId || !clientSecret || !appOrigin) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    appOrigin: appOrigin.replace(/\/$/, ""),
  };
}

export function buildGithubAuthorizeUrl(config: { clientId: string; appOrigin: string }, state: string) {
  const url = new URL(GITHUB_AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", `${config.appOrigin}/api/v1/auth/github/callback`);
  url.searchParams.set("scope", "read:user user:email");
  url.searchParams.set("state", state);
  return url.toString();
}

export function createGithubOauthState() {
  return generateSessionToken();
}

export async function exchangeGithubCode(
  config: { clientId: string; clientSecret: string; appOrigin: string },
  code: string,
): Promise<string> {
  const response = await fetch(GITHUB_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "ClawLodge",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${config.appOrigin}/api/v1/auth/github/callback`,
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !payload.access_token) {
    throw new ApiError(502, payload.error_description || payload.error || "GitHub token exchange failed");
  }

  return payload.access_token;
}

async function githubFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${GITHUB_API_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "ClawLodge",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(502, `GitHub API request failed: ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchGithubUserProfile(accessToken: string): Promise<GithubUserProfile> {
  const profile = await githubFetch<GithubUserProfile>("/user", accessToken);
  if (profile.email) {
    return profile;
  }

  try {
    const emails = await githubFetch<GithubEmailRecord[]>("/user/emails", accessToken);
    const primary = emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified);
    return {
      ...profile,
      email: primary?.email ?? null,
    };
  } catch {
    return profile;
  }
}
