import Link from "next/link";
import { redirect } from "next/navigation";

import { apiOrigin } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/";
  const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent(next)}`;

  if (!params.error) {
    redirect(githubLoginUrl);
  }

  return (
    <div className="page-shell">
      <section className="shell page-panel p-6">
        <h1 className="page-title">Login</h1>
        <p className="page-subtitle">Jump to GitHub, approve once, then come straight back into ClawLodge.</p>
        <div className="hero-actions mt-6">
          <a className="btn btn-primary" href={githubLoginUrl}>
            Login with GitHub
          </a>
          <Link className="btn" href={next}>
            Back
          </Link>
        </div>
        {params.error ? <p className="mt-4 text-sm text-red-600">{params.error}</p> : null}
      </section>
    </div>
  );
}
