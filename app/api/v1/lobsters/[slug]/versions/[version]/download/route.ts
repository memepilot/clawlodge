import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { buildLobsterVersionZip } from "@/lib/server/service";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ slug: string; version: string }> },
) {
  try {
    const { slug, version } = await params;
    const archive = await buildLobsterVersionZip(slug, version);
    return new NextResponse(Buffer.from(archive.body), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${archive.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
