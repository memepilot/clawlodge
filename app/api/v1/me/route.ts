import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { getMe } from "@/lib/server/service";

export async function GET() {
  try {
    const user = await requireSessionUser();
    return NextResponse.json(await getMe(user.id));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
