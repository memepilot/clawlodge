import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getWorkspaceFilePreview } from "@/lib/server/service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; version: string }> },
) {
  try {
    const { slug, version } = await params;
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path")?.trim();
    if (!filePath) {
      return NextResponse.json({ detail: "Missing file path" }, { status: 400 });
    }
    return NextResponse.json(await getWorkspaceFilePreview(slug, version, filePath));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
