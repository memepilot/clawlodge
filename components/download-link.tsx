"use client";

import { useMemo } from "react";

type DownloadLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|FxiOS|Firefox|Android/i.test(ua);
}

function ensureDownloadFrame() {
  let frame = document.getElementById("clawlodge-download-frame") as HTMLIFrameElement | null;
  if (frame) return frame;

  frame = document.createElement("iframe");
  frame.id = "clawlodge-download-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.style.position = "fixed";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.opacity = "0";
  frame.style.pointerEvents = "none";
  document.body.appendChild(frame);
  return frame;
}

export function DownloadLink({ href, className, children }: DownloadLinkProps) {
  const safari = useMemo(() => isSafariBrowser(), []);

  return (
    <a
      className={className}
      href={href}
      download
      onClick={(event) => {
        if (!safari) return;
        event.preventDefault();
        const frame = ensureDownloadFrame();
        frame.src = href;
      }}
    >
      {children}
    </a>
  );
}
