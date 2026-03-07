import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getUserProfile } from "@/lib/server/service";

export async function GET(_: Request, { params }: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await params;
    return NextResponse.json(await getUserProfile(handle));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
