"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();
const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim();
const lobsterClickConversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_LOBSTER_CLICK_LABEL?.trim();

function sendToValue(label?: string | null) {
  if (!googleAdsId || !label) return null;
  return `${googleAdsId}/${label}`;
}

export function trackLobsterClickConversion(slug: string) {
  const sendTo = sendToValue(lobsterClickConversionLabel);
  if (!sendTo || typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  window.gtag("event", "conversion", {
    send_to: sendTo,
    event_category: "lobster",
    event_label: slug,
  });
}

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined" || typeof window.gtag !== "function") {
      return;
    }

    const query = searchParams.toString();
    const pagePath = query ? `${pathname}?${query}` : pathname;
    window.gtag("config", measurementId, {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title,
    });
    if (googleAdsId) {
      window.gtag("config", googleAdsId);
    }
  }, [pathname, searchParams]);

  if (!measurementId && !googleAdsId) {
    return null;
  }

  const ids = [measurementId, googleAdsId].filter(Boolean) as string[];
  const primaryScriptId = ids[0];

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${primaryScriptId}`} strategy="afterInteractive" />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          ${measurementId ? `gtag('config', '${measurementId}', { send_page_view: false });` : ""}
          ${googleAdsId ? `gtag('config', '${googleAdsId}');` : ""}
        `}
      </Script>
    </>
  );
}
