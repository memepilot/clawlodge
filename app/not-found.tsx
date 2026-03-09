import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">404</p>
        <h1 className="page-title mt-3">Page not found</h1>
        <p className="page-subtitle mt-3">
          The link may be stale, the setup may have moved, or the page was never published here.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/">
            Back to home
          </Link>
          <Link className="btn" href="/publish">
            Publish your setup
          </Link>
        </div>
      </section>
    </div>
  );
}
