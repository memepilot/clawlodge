const FALLBACK_ICON = "/logo-mark.svg";
const ICON_CACHE_VERSION = "20260320b";

function appendIconVersion(url: string) {
  if (!url.startsWith("/api/v1/storage/")) {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  if (url.includes("v=")) {
    return url;
  }
  return `${url}${separator}v=${ICON_CACHE_VERSION}`;
}

function getThumbnailSrc(iconUrl: string) {
  if (!iconUrl.startsWith("/api/v1/storage/")) {
    return iconUrl;
  }

  const suffixMatch = iconUrl.match(/^(.*\/)([^/?]+?)(\.[^./?]+)(\?.*)?$/);
  if (!suffixMatch) {
    return iconUrl;
  }

  const [, prefix, filename] = suffixMatch;
  return appendIconVersion(`${prefix}${filename}-52.webp`);
}

export function getLobsterAvatarSrc(iconUrl?: string | null, size?: number) {
  if (!iconUrl) {
    return FALLBACK_ICON;
  }
  return size && size <= 56 ? getThumbnailSrc(iconUrl) : appendIconVersion(iconUrl);
}

export function LobsterAvatar({
  iconUrl,
  alt,
  size,
  className,
  eager = false,
}: {
  iconUrl?: string | null;
  alt: string;
  size: number;
  className?: string;
  eager?: boolean;
}) {
  const src = getLobsterAvatarSrc(iconUrl, size);
  const shouldEagerLoad = eager || size >= 96;

  return (
    <span
      className={className ? `lobster-avatar ${className}` : "lobster-avatar"}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        className="lobster-avatar-image"
        loading={shouldEagerLoad ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={shouldEagerLoad ? "high" : "low"}
        width={size}
        height={size}
      />
    </span>
  );
}
