import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { ApiError } from "@/lib/server/errors";
import { getStoredObject } from "@/lib/server/storage";

export async function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const params = await context.params;
    const key = params.key.join('/');
    const object = await getStoredObject(key);
    const etag = `"${createHash("sha1").update(object.body).digest("hex")}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    const ifModifiedSince = request.headers.get("if-modified-since");

    if (ifNoneMatch === etag || ifModifiedSince === object.lastModified) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Last-Modified": object.lastModified,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(object.body, {
      status: 200,
      headers: {
        "Content-Type": object.contentType,
        "Content-Disposition": `inline; filename="${object.filename}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": String(object.size),
        ETag: etag,
        "Last-Modified": object.lastModified,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
