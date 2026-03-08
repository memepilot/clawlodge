import { NextRequest, NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { createLobster, listLobsters } from "@/lib/server/service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sort = searchParams.get("sort") ?? undefined;
  const tag = searchParams.get("tag") ?? undefined;
  const q = searchParams.get("q") ?? undefined;
  const pageValue = searchParams.get("page");
  const perPageValue = searchParams.get("per_page");
  const page = pageValue ? Number.parseInt(pageValue, 10) : undefined;
  const per_page = perPageValue ? Number.parseInt(perPageValue, 10) : undefined;

  return NextResponse.json(await listLobsters({ sort, tag, q, ...(Number.isFinite(page) ? { page } : {}), ...(Number.isFinite(per_page) ? { per_page } : {}) }));
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
