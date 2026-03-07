import { cookies } from "next/headers";

import { ApiError } from "./errors";
import { mutateDb, readDb } from "./store";
import { generateSessionToken, sha256 } from "./utils";

export const SESSION_COOKIE = "clawlodge_session_token";
export const GITHUB_OAUTH_COOKIE = "clawlodge_github_oauth";

const isProduction = process.env.NODE_ENV === "production";

export function buildCookieOptions(expiresAt: string | Date) {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    expires: typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt,
  };
}

export function buildExpiredCookieOptions() {
  return buildCookieOptions(new Date(0));
}

export async function createSessionForUser(userId: number) {
  const raw = generateSessionToken();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString();

  await mutateDb((db) => {
    db.sessions.push({
      id: db.nextIds.session++,
      userId,
      tokenHash: sha256(raw),
      expiresAt,
      createdAt: new Date().toISOString(),
    });
  });

  return { token: raw, expiresAt };
}

export function encodeGithubOauthState(payload: { state: string; next: string }) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeGithubOauthState(value?: string | null): { state: string; next: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      state?: string;
      next?: string;
    };
    if (!parsed.state || !parsed.next || !parsed.next.startsWith("/")) {
      return null;
    }
    return { state: parsed.state, next: parsed.next };
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const db = await readDb();
  const tokenHash = sha256(raw);
  const session = db.sessions.find((item) => item.tokenHash === tokenHash);
  if (!session) return null;
  if (+new Date(session.expiresAt) < Date.now()) return null;
  return db.users.find((user) => user.id === session.userId) ?? null;
}

export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError(401, "Authentication required");
  }
  return user;
}

export async function requirePatUser(authorization?: string | null) {
  if (!authorization?.startsWith("Bearer ")) {
    throw new ApiError(401, "PAT required");
  }
  const token = authorization.slice(7).trim();
  const db = await readDb();
  const tokenHash = sha256(token);
  const record = db.apiTokens.find((item) => item.tokenHash === tokenHash && !item.revoked);
  if (!record) {
    throw new ApiError(401, "Invalid PAT");
  }

  await mutateDb((draft) => {
    const match = draft.apiTokens.find((item) => item.id === record.id);
    if (match) match.lastUsedAt = new Date().toISOString();
  });

  const user = db.users.find((item) => item.id === record.userId);
  if (!user) {
    throw new ApiError(401, "User not found");
  }
  return user;
}
