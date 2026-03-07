import Link from "next/link";

export default function AuthCallbackPage() {
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6">
        <h1 className="page-title">GitHub login moved</h1>
        <p className="page-subtitle">Auth now completes on the API callback route and sends you straight back to the page you asked for.</p>
        <div className="hero-actions mt-4">
          <Link className="btn btn-primary" href="/login">
            Login
          </Link>
          <Link className="btn" href="/">
            Home
          </Link>
        </div>
      </section>
    </div>
  );
}
