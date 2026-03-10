import { LobsterCard } from "@/components/lobster-card";
import { getTranslations } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/server/locale";
import { getUserProfile } from "@/lib/server/service";

export default async function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getUserProfile(handle);
  const locale = await getRequestLocale();
  const t = getTranslations(locale);

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          @{profile.user.handle}
        </h1>
        <p className="page-subtitle">{profile.user.display_name ?? t.profile.anonymous}</p>
        {profile.hire_profile ? (
          <div className="callout mt-3 text-sm">
            <div>{t.profile.status}: {profile.hire_profile.status}</div>
            <div>
              {t.profile.contact}: {profile.hire_profile.contact_type ?? "-"} {profile.hire_profile.contact_value ?? ""}
            </div>
          </div>
        ) : null}
      </section>

      <section className="stack-md">
        <h2 className="panel-title">{t.profile.published}</h2>
        {profile.published.length ? (
          profile.published.map((item) => <LobsterCard key={item.slug} item={item} locale={locale} />)
        ) : (
          <div className="card muted">{t.profile.noPublished}</div>
        )}
      </section>

      <section className="stack-md">
        <h2 className="panel-title">{t.profile.favorites}</h2>
        {profile.favorites.length ? (
          profile.favorites.map((item) => <LobsterCard key={`fav-${item.slug}`} item={item} locale={locale} />)
        ) : (
          <div className="card muted">{t.profile.noFavorites}</div>
        )}
      </section>
    </div>
  );
}
