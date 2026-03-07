import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { listSeeds, upsertSeedMetadata } from "@/lib/server/service";

export async function GET() {
  try {
    await requireSessionUser();
    return NextResponse.json(await listSeeds());
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser();
    const body = await request.json();
    return NextResponse.json(await upsertSeedMetadata(user.id, body));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
