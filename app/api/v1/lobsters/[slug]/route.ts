import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getLobsterBySlug } from "@/lib/server/service";

const PUBLIC_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return NextResponse.json(await getLobsterBySlug(slug), {
      headers: {
        "Cache-Control": PUBLIC_CACHE_CONTROL,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
