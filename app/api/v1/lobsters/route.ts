import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { createLobster, listLobsters } from "@/lib/server/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  return NextResponse.json(await listLobsters({ sort, tag, q }));
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const payload = await request.json();
    return NextResponse.json(await createLobster(user.id, payload));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
