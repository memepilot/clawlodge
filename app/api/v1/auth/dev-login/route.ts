import { NextResponse } from "next/server";

import { buildCookieOptions, createSessionForUser, SESSION_COOKIE } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { findOrCreateUserByHandle } from "@/lib/server/service";

const allowDevAuth = process.env.ALLOW_DEV_AUTH === "true";

export async function POST(request: Request) {
  if (!allowDevAuth) {
    return NextResponse.json({ detail: "Not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const user = await findOrCreateUserByHandle(String(body.handle ?? ""));
    const session = await createSessionForUser(user.id);
    const response = NextResponse.json({ token: session.token, handle: user.handle });
    response.cookies.set(SESSION_COOKIE, session.token, buildCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
