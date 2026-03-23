"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { useTranslations } from "@/components/locale-provider";
import { useLocale } from "@/components/locale-provider";
import { Locale } from "@/lib/i18n";
import { localizePath, stripLocalePrefix } from "@/lib/locale-routing";

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const barePath = stripLocalePrefix(pathname).pathname;
  const query = searchParams?.toString() ? `?${searchParams.toString()}` : "";
  const options: Array<{ locale: Locale; label: string }> = [
    { locale: "en", label: "English" },
    { locale: "zh", label: "中文" },
    { locale: "ja", label: "日本語" },
    { locale: "fr", label: "Français" },
  ];

  return (
    <label className="locale-switcher" aria-label={t.nav.language}>
      <span className="sr-only">{t.nav.language}</span>
      <select
        className="locale-select"
        value={locale}
        onChange={(event) => {
          const nextLocale = event.target.value as Locale;
          const nextPath = `${localizePath(barePath, nextLocale)}${query}`;
          window.location.href = `/api/v1/locale?locale=${encodeURIComponent(nextLocale)}&next=${encodeURIComponent(nextPath)}`;
        }}
      >
        {options.map((option) => (
          <option
            key={option.locale}
            value={option.locale}
            lang={option.locale === "zh" ? "zh-CN" : option.locale === "fr" ? "fr-FR" : option.locale}
          >
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
