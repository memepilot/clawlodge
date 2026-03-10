"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import Link from "next/link";

import { useTranslations } from "@/components/locale-provider";
import { apiOrigin, getMe, logout } from "@/lib/api";
import { MeProfile } from "@/lib/types";

export function HeaderAuth() {
  const pathname = usePathname();
  const t = useTranslations();

  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getMe()
      .then((result) => setProfile(result))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, []);

  const nextPath = pathname || "/";

  if (!loaded) {
    return <span className="muted text-xs">...</span>;
  }

  if (!profile) {
    const githubLoginUrl = `${apiOrigin}/api/v1/auth/github/start?next=${encodeURIComponent(nextPath)}`;
    return (
      <a className="btn" href={githubLoginUrl}>
        {t.auth.loginWithGithub}
      </a>
    );
  }

  const handle = profile.user.handle;
  const displayName = profile.user.display_name || handle;
  const avatarUrl = profile.user.avatar_url;
  const initial = displayName.slice(0, 1).toUpperCase();

  async function onLogout() {
    await logout();
    setProfile(null);
    window.location.href = "/";
  }

  return (
    <div className="auth-cluster">
      <Link
        href={`/u/${handle}`}
        className="user-trigger"
        title={`@${handle}`}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="user-menu-fallback">
            {initial}
          </span>
        )}
        <span className="text-sm font-semibold">@{handle}</span>
      </Link>
      <button className="btn btn-quiet" type="button" onClick={onLogout}>
        {t.auth.logout}
      </button>
    </div>
  );
}
