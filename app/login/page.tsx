import { redirect } from "next/navigation";

import { apiOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";
  redirect(`${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent(next)}`);
}
