import { cookies, headers } from "next/headers";

import { detectLocale, localeCookieName, type Locale } from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(localeCookieName)?.value;
  if (saved === "en" || saved === "zh") return saved;
  const requestHeaders = await headers();
  return detectLocale(requestHeaders.get("accept-language"));
}
