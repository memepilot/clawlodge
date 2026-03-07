import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { updateHireProfile } from "@/lib/server/service";

export async function PUT(request: Request) {
  try {
    const user = await requireSessionUser();
    const payload = await request.json();
    return NextResponse.json(await updateHireProfile(user.id, payload));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
