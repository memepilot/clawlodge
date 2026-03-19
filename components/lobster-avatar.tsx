const FALLBACK_ICON = "/logo-mark.svg";

export function getLobsterAvatarSrc(iconUrl?: string | null) {
  return iconUrl || FALLBACK_ICON;
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
  const src = getLobsterAvatarSrc(iconUrl);
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
