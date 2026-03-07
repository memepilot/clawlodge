"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { apiOrigin, getMe, getSeeds, rotateToken, saveSeed, updateHireProfile } from "@/lib/api";
import { MeProfile, SeedRecord } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [seeds, setSeeds] = useState<SeedRecord[]>([]);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    getMe()
      .then(setProfile)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Failed to fetch profile"));
    getSeeds().then(setSeeds).catch(() => {});
  }, []);

  const githubLoginUrl = useMemo(() => `${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent("/settings")}`, []);

  async function onRotate() {
    setMessage("");
    try {
      const result = await rotateToken();
      setToken(result.token);
      const updated = await getMe();
      setProfile(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Rotate token failed");
    }
  }

  async function onSaveHire(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await updateHireProfile({
        status: String(fd.get("status") || "closed") as "open" | "closed",
        contact_type: String(fd.get("contact_type") || "").trim() || undefined,
        contact_value: String(fd.get("contact_value") || "").trim() || undefined,
        timezone: String(fd.get("timezone") || "").trim() || undefined,
        response_sla_hours: Number(fd.get("response_sla_hours") || 0) || undefined,
      });
      setMessage("Saved hire profile");
      setProfile(await getMe());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    }
  }

  async function onSaveSeed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await saveSeed({
        slug: String(fd.get("slug") || ""),
        source_type: String(fd.get("source_type") || "curated") as SeedRecord["source_type"],
        source_url: String(fd.get("source_url") || "").trim() || undefined,
        original_author: String(fd.get("original_author") || "").trim() || undefined,
        verified: fd.get("verified") === "on",
        curation_note: String(fd.get("curation_note") || "").trim() || undefined,
        seeded: true,
      });
      setMessage("Saved seed metadata");
      setSeeds(await getSeeds());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Seed save failed");
    }
  }

  return (
    <div className="page-shell stack-lg">
      <section className="shell page-panel p-5 md:p-6">
        <h1 className="page-title">
          Settings
        </h1>
        <p className="page-subtitle">Manage login, MCP token, and hire profile.</p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link className="btn btn-primary" href={githubLoginUrl}>
            {profile ? "Reconnect GitHub" : "Connect GitHub"}
          </Link>
          {profile ? <span className="text-sm muted">Linked as @{profile.user.handle}</span> : null}
        </div>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">MCP Token</h2>
        <p className="page-subtitle">
          Active prefix: {profile?.active_token_prefix ?? "none"} / last used: {profile?.active_token_last_used_at ?? "-"}
        </p>
        <button className="btn mt-3" onClick={onRotate}>
          Rotate Token
        </button>
        {token ? (
          <div className="callout mt-3 text-sm">
            <strong>Copy now:</strong> {token}
          </div>
        ) : null}
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">Hire Profile</h2>
        <form className="form-grid mt-3" onSubmit={onSaveHire}>
          <select className="select" name="status" defaultValue={profile?.hire_profile?.status ?? "closed"}>
            <option value="closed">closed</option>
            <option value="open">open</option>
          </select>
          <input className="input" name="contact_type" placeholder="contact type (email/discord/url)" defaultValue={profile?.hire_profile?.contact_type ?? ""} />
          <input className="input" name="contact_value" placeholder="contact value" defaultValue={profile?.hire_profile?.contact_value ?? ""} />
          <input className="input" name="timezone" placeholder="timezone" defaultValue={profile?.hire_profile?.timezone ?? ""} />
          <input className="input" type="number" min={1} max={720} name="response_sla_hours" placeholder="response SLA (hours)" defaultValue={profile?.hire_profile?.response_sla_hours ?? ""} />
          <button className="btn btn-primary" type="submit">
            Save
          </button>
        </form>
      </section>

      <section className="shell page-panel p-5 md:p-6">
        <h2 className="panel-title">Seed Content</h2>
        <p className="page-subtitle">Curate official, demo, and imported starter content for cold start.</p>
        <div className="seed-list mt-4">
          {seeds.map((seed) => (
            <div key={seed.slug} className="subcard">
              <div className="font-medium">{seed.slug}</div>
              <div className="muted text-sm">
                {seed.source_type} {seed.verified ? "· verified" : ""}
              </div>
            </div>
          ))}
        </div>
        <form className="form-grid mt-4" onSubmit={onSaveSeed}>
          <input className="input" name="slug" placeholder="lobster slug" required />
          <select className="select" name="source_type" defaultValue="curated">
            <option value="official">official</option>
            <option value="curated">curated</option>
            <option value="community">community</option>
            <option value="demo">demo</option>
          </select>
          <input className="input" name="source_url" placeholder="source url" />
          <input className="input" name="original_author" placeholder="original author" />
          <textarea className="textarea min-h-24" name="curation_note" placeholder="curation note" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="verified" />
            Verified
          </label>
          <button className="btn btn-primary" type="submit">
            Save Seed Metadata
          </button>
        </form>
      </section>

      {message ? <p className="text-sm text-[var(--brand)]">{message}</p> : null}
    </div>
  );
}
