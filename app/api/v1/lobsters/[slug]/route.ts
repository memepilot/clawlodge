import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getLobsterBySlug } from "@/lib/server/service";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return NextResponse.json(await getLobsterBySlug(slug));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
