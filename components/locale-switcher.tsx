"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { useTranslations } from "@/components/locale-provider";
import { useLocale } from "@/components/locale-provider";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
  const targetLocale = locale === "zh" ? "en" : "zh";
  const href = `/api/v1/locale?locale=${encodeURIComponent(targetLocale)}&next=${encodeURIComponent(next)}`;

  return (
    <a className="btn btn-quiet" href={href} hrefLang={targetLocale}>
      {t.nav.language}
    </a>
  );
}
