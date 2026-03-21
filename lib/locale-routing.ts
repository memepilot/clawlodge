import type { Locale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/site";

export const localePathPrefixes = ["zh", "ja"] as const;

export type PathLocale = (typeof localePathPrefixes)[number];

export function isPathLocale(value: string): value is PathLocale {
  return localePathPrefixes.includes(value as PathLocale);
}

export function localizePath(pathname: string, locale: Locale) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === "en") return normalized;
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}

export function stripLocalePrefix(pathname: string) {
  const normalized = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const segments = normalized.split("/");
  const maybeLocale = segments[1];
  if (!maybeLocale || !isPathLocale(maybeLocale)) {
    return { locale: null as Locale | null, pathname: normalized };
  }
  const rest = `/${segments.slice(2).join("/")}`.replace(/\/+$/, "") || "/";
  return { locale: maybeLocale, pathname: rest === "//" ? "/" : rest };
}

export function localeHtmlLang(locale: Locale) {
  switch (locale) {
    case "zh":
      return "zh-CN";
    case "ja":
      return "ja";
    default:
      return "en";
  }
}

export function buildLocaleAlternates(pathname: string, currentLocale: Locale) {
  return {
    canonical: absoluteUrl(localizePath(pathname, currentLocale)),
    languages: {
      en: absoluteUrl(localizePath(pathname, "en")),
      "zh-CN": absoluteUrl(localizePath(pathname, "zh")),
      ja: absoluteUrl(localizePath(pathname, "ja")),
      "x-default": absoluteUrl(localizePath(pathname, "en")),
    },
  };
}
