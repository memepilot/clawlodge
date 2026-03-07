import { NextResponse } from "next/server";

import { requirePatUser } from "@/lib/server/auth";
import { ApiError } from "@/lib/server/errors";
import { uploadViaMcp } from "@/lib/server/service";

export async function POST(request: Request) {
  try {
    const user = await requirePatUser(request.headers.get("authorization"));
    const formData = await request.formData();

    const manifestFile = formData.get("manifest.json");
    const readmeFile = formData.get("README.md");
    const skillsFile = formData.get("skills_bundle");

    if (!(manifestFile instanceof File) || !(readmeFile instanceof File) || !(skillsFile instanceof File)) {
      throw new ApiError(400, "manifest.json, README.md, skills_bundle are required");
    }

    if (!manifestFile.size || !readmeFile.size || !skillsFile.size) {
      throw new ApiError(400, "Uploaded files must be non-empty");
    }
    if (!manifestFile.name.endsWith(".json") || !readmeFile.name.endsWith(".md") || !skillsFile.name.endsWith(".zip")) {
      throw new ApiError(400, "Unexpected file types for MCP upload");
    }

    return NextResponse.json(
      await uploadViaMcp(user.id, {
        manifestRaw: Buffer.from(await manifestFile.arrayBuffer()),
        readmeRaw: Buffer.from(await readmeFile.arrayBuffer()),
        skillsRaw: Buffer.from(await skillsFile.arrayBuffer()),
      }),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ detail: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
