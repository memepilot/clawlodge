import { HomePage } from "@/components/home-page";
import { buildLocaleAlternates } from "@/lib/locale-routing";
import { getRequestLocale } from "@/lib/server/locale";
import { siteConfig } from "@/lib/site";

export const revalidate = 300;

export const metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
  alternates: buildLocaleAlternates("/", "en"),
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; tag?: string; q?: string; category?: string; page?: string }>;
}) {
  const params = await searchParams;
  const locale = await getRequestLocale();
  return <HomePage locale={locale} searchParams={params} />;
}
