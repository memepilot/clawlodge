import Link from "next/link";

import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";

export default async function NotFound() {
  const locale = await getRequestLocale();
  const t = getTranslations(locale);
  return (
    <div className="page-shell">
      <section className="shell page-panel p-6 md:p-8">
        <p className="field-label">{t.notFound.label}</p>
        <h1 className="page-title mt-3">{t.notFound.title}</h1>
        <p className="page-subtitle mt-3">
          {t.notFound.body}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="btn btn-primary" href="/">
            {t.notFound.home}
          </Link>
          <Link className="btn" href="/publish">
            {t.notFound.publish}
          </Link>
        </div>
      </section>
    </div>
  );
}
