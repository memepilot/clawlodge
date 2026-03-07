import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getStoredObject } from "@/lib/server/storage";

export async function GET(_: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const params = await context.params;
    const key = params.key.join('/');
    const object = await getStoredObject(key);
    return new NextResponse(object.body, {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Content-Disposition": `inline; filename="${object.filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
