"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";

import { trackLobsterClickConversion } from "@/components/google-analytics";

type TrackedLobsterLinkProps = PropsWithChildren<{
  href: string;
  slug: string;
  className?: string;
  ariaLabel?: string;
}>;

export function TrackedLobsterLink({ href, slug, className, ariaLabel, children }: TrackedLobsterLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      aria-label={ariaLabel}
      onClick={() => trackLobsterClickConversion(slug)}
    >
      {children}
    </Link>
  );
}
