import { LobsterCard } from "@/components/lobster-card";
import { getUserProfile } from "@/lib/server/service";

export default async function UserPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getUserProfile(handle);

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          @{profile.user.handle}
        </h1>
        <p className="page-subtitle">{profile.user.display_name ?? "Anonymous"}</p>
        {profile.hire_profile ? (
          <div className="callout mt-3 text-sm">
            <div>Status: {profile.hire_profile.status}</div>
            <div>
              Contact: {profile.hire_profile.contact_type ?? "-"} {profile.hire_profile.contact_value ?? ""}
            </div>
          </div>
        ) : null}
      </section>

      <section className="stack-md">
        <h2 className="panel-title">Published</h2>
        {profile.published.length ? (
          profile.published.map((item) => <LobsterCard key={item.slug} item={item} />)
        ) : (
          <div className="card muted">No published lobster yet.</div>
        )}
      </section>

      <section className="stack-md">
        <h2 className="panel-title">Favorites</h2>
        {profile.favorites.length ? (
          profile.favorites.map((item) => <LobsterCard key={`fav-${item.slug}`} item={item} />)
        ) : (
          <div className="card muted">No favorites yet.</div>
        )}
      </section>
    </div>
  );
}
