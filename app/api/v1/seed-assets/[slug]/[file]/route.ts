import { NextResponse } from "next/server";

import { getMockLobster } from "@/lib/mock-data";

export async function GET(_: Request, context: { params: Promise<{ slug: string; file: string }> }) {
  const { slug, file } = await context.params;
  const lobster = getMockLobster(slug);
  const version = lobster?.versions[0];

  if (!lobster || !version) {
    return NextResponse.json({ detail: "Seed asset not found" }, { status: 404 });
  }

  if (file === 'README.md') {
    return new NextResponse(version.readme_text, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
  }

  if (file === 'manifest.json') {
    const manifest = {
      schema_version: '1.0',
      lobster_slug: lobster.slug,
      version: version.version,
      name: lobster.name,
      summary: lobster.summary,
      license: lobster.license,
      readme_path: 'README.md',
      skills: version.skills.map((skill) => ({
        id: skill.skill_id,
        name: skill.name,
        entry: skill.entry,
        path: skill.path,
      })),
      settings: [],
      source: {
        repo_url: version.source_repo ?? null,
        commit: version.source_commit ?? null,
      },
    };
    return NextResponse.json(manifest);
  }

  return NextResponse.json({ detail: 'Seed asset not found' }, { status: 404 });
}
