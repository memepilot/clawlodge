"use client";

import { createContext, useContext } from "react";

import { messages, type Locale, type Messages } from "@/lib/i18n";

const LocaleContext = createContext<{ locale: Locale; messages: Messages } | null>(null);

export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={{ locale, messages }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext)?.locale ?? "en";
}

export function useTranslations() {
  return useContext(LocaleContext)?.messages ?? (messages.en as Messages);
}
