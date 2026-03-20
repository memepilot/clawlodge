const FALLBACK_ICON = "/logo-mark.svg";

function getThumbnailSrc(iconUrl: string) {
  if (!iconUrl.startsWith("/api/v1/storage/")) {
    return iconUrl;
  }

  const suffixMatch = iconUrl.match(/^(.*\/)([^/?]+?)(\.[^./?]+)(\?.*)?$/);
  if (!suffixMatch) {
    return iconUrl;
  }

  const [, prefix, filename] = suffixMatch;
  return `${prefix}${filename}-52.webp`;
}

export function getLobsterAvatarSrc(iconUrl?: string | null, size?: number) {
  if (!iconUrl) {
    return FALLBACK_ICON;
  }
  return size && size <= 56 ? getThumbnailSrc(iconUrl) : iconUrl;
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
