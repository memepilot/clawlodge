import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getLobsterVersion } from "@/lib/server/service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string; version: string }> },
) {
  try {
    const { slug, version } = await params;
    return NextResponse.json(await getLobsterVersion(slug, version));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
