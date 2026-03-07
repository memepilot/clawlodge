import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { addShare } from "@/lib/server/service";

export async function POST(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return NextResponse.json(await addShare(slug));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
