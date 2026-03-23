import { cookies, headers } from "next/headers";

import { detectLocale, localeCookieName, type Locale } from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const routed = requestHeaders.get("x-clawlodge-locale");
  if (routed === "en" || routed === "zh" || routed === "ja" || routed === "fr") return routed;
  const cookieStore = await cookies();
  const saved = cookieStore.get(localeCookieName)?.value;
  if (saved === "en" || saved === "zh" || saved === "ja" || saved === "fr") return saved;
  return detectLocale(requestHeaders.get("accept-language"));
}
