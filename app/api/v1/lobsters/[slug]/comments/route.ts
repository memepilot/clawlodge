import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { addComment, getComments } from "@/lib/server/service";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    return NextResponse.json(await getComments(slug));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireApiUser(request.headers.get("authorization"));
    const { slug } = await params;
    const body = await request.json();
    return NextResponse.json(await addComment(user.id, slug, String(body.content ?? "")), { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
