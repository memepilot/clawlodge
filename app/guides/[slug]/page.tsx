import type { Metadata } from "next";

import { GuidePage } from "@/components/guide-page";
import { getGuides, buildGuideMetadata, getGuideBySlug } from "@/lib/guides";
import { absoluteUrl } from "@/lib/site";

export function generateStaticParams() {
  return getGuides().map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug, "en");
  if (!guide) {
    return {
      title: "Guide",
      alternates: {
        canonical: absoluteUrl(`/guides/${slug}`),
      },
    };
  }
  return buildGuideMetadata(guide, "en");
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GuidePage slug={slug} locale="en" />;
}
