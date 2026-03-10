const FALLBACK_ICON = "/logo-mark.svg";

export function getLobsterAvatarSrc(iconUrl?: string | null) {
  return iconUrl || FALLBACK_ICON;
}

export function LobsterAvatar({
  iconUrl,
  alt,
  size,
  className,
}: {
  iconUrl?: string | null;
  alt: string;
  size: number;
  className?: string;
}) {
  const src = getLobsterAvatarSrc(iconUrl);
  const eager = size >= 96;

  return (
    <span
      className={className ? `lobster-avatar ${className}` : "lobster-avatar"}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="lobster-avatar-image"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "low"}
      />
    </span>
  );
}
