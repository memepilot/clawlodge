import { NextResponse } from "next/server";

import { buildExpiredCookieOptions, SESSION_COOKIE } from "@/lib/server/auth";
import { mutateDb } from "@/lib/server/store";
import { sha256 } from "@/lib/server/utils";

export async function POST(request: Request) {
  const raw = request.headers.get("cookie")?.match(/clawlodge_session_token=([^;]+)/)?.[1];
  if (raw) {
    await mutateDb((db) => {
      db.sessions = db.sessions.filter((item) => item.tokenHash !== sha256(raw));
    });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", buildExpiredCookieOptions());
  return response;
}
