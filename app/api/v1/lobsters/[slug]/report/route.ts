import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { submitReport } from "@/lib/server/service";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireSessionUser();
    const { slug } = await params;
    const body = await request.json();
    return NextResponse.json(await submitReport(user.id, slug, String(body.reason ?? "")), { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
