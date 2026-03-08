import { NextResponse } from "next/server";

import { requirePatUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { getMe } from "@/lib/server/service";

export async function GET(request: Request) {
  try {
    const user = await requirePatUser(request.headers.get("authorization"));
    return NextResponse.json(await getMe(user.id));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
