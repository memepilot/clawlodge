import Image from "next/image";

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
  return (
    <span
      className={className ? `lobster-avatar ${className}` : "lobster-avatar"}
      aria-hidden="true"
      style={{ width: size, height: size }}
    >
      <Image
        src={getLobsterAvatarSrc(iconUrl)}
        alt={alt}
        width={size}
        height={size}
        className="lobster-avatar-image"
        unoptimized
      />
    </span>
  );
}
