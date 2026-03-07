import { NextResponse } from "next/server";

import { requirePatUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { publishWorkspace } from "@/lib/server/service";
import type { WorkspacePublishPayload } from "@/lib/server/workspace-publish";

export async function POST(request: Request) {
  try {
    const user = await requirePatUser(request.headers.get("authorization"));
    const body = (await request.json()) as WorkspacePublishPayload;
    return NextResponse.json(await publishWorkspace(user.id, body));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ detail: error.message }, { status: 400 });
    }
    throw error;
  }
}
