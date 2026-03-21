import type { Metadata } from "next";
import { notFound } from "next/navigation";

import LobsterDetailPage, { generateMetadata as generateBaseMetadata } from "../../../lobsters/[slug]/page";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (locale !== "zh" && locale !== "ja") return {};
  return generateBaseMetadata({ params: Promise.resolve({ slug }) });
}

export default async function LocalizedLobsterDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (locale !== "zh" && locale !== "ja") notFound();
  return <LobsterDetailPage params={Promise.resolve({ slug })} />;
}
