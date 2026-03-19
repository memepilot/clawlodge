const FALLBACK_ICON = "/logo-mark.svg";

function getThumbnailSrc(iconUrl: string, size: number) {
  if (!iconUrl.startsWith("/api/v1/storage/") || size > 56) {
    return iconUrl;
  }

  const suffixMatch = iconUrl.match(/^(.*\/)([^/?]+?)(\.[^./?]+)(\?.*)?$/);
  if (!suffixMatch) {
    return iconUrl;
  }

  const [, prefix, filename] = suffixMatch;
  const thumbSize = 52;
  return `${prefix}${filename}-${thumbSize}.webp`;
}

export function getLobsterAvatarSrc(iconUrl?: string | null, size?: number) {
  if (!iconUrl) {
    return FALLBACK_ICON;
  }
  return size ? getThumbnailSrc(iconUrl, size) : iconUrl;
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
