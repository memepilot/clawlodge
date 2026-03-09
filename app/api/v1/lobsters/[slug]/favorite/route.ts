import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { addFavorite, removeFavorite } from "@/lib/server/service";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireApiUser(request.headers.get("authorization"));
    const { slug } = await params;
    return NextResponse.json(await addFavorite(user.id, slug));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await requireApiUser(request.headers.get("authorization"));
    const { slug } = await params;
    return NextResponse.json(await removeFavorite(user.id, slug));
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    throw error;
  }
}
