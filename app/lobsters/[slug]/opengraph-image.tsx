import { readFile } from "node:fs/promises";
import path from "node:path";

import { ImageResponse } from "next/og";

import { getDetailDisplayLobsterName } from "@/lib/lobster-display";
import { getLobsterBySlug } from "@/lib/server/service";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

function sanitizeOgText(value: string | null | undefined, fallback: string) {
  const normalized = (value || "")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

async function loadIconDataUrl(iconUrl: string | null | undefined) {
  const dataDir = process.env.CLAWLODGE_DATA_DIR?.trim() || "/var/lib/clawlodge";
  const storagePrefix = "/api/v1/storage/";
  const iconKey = iconUrl?.startsWith(storagePrefix) ? iconUrl.slice(storagePrefix.length) : null;
  const candidates = [
    iconKey ? path.join(dataDir, "storage", iconKey) : null,
    path.join(process.cwd(), "public", "icon.png"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const bytes = await readFile(candidate);
      return `data:image/png;base64,${bytes.toString("base64")}`;
    } catch {}
  }

  return null;
}

function categoryLabel(category: string | null | undefined) {
  switch (category) {
    case "skill":
      return "OpenClaw Skill";
    case "agent":
      return "OpenClaw Agent";
    case "workflow":
      return "OpenClaw Workflow";
    case "memory":
      return "Memory System";
    case "tooling":
      return "Tooling";
    case "workspace":
    default:
      return "OpenClaw Setup";
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lobster = await getLobsterBySlug(slug);
  const displayName = sanitizeOgText(getDetailDisplayLobsterName(lobster), slug);
  const summary = sanitizeOgText(lobster.summary, "Inspect this OpenClaw setup on ClawLodge.");
  const badgeText = displayName.slice(0, 1).toUpperCase();
  const iconDataUrl = await loadIconDataUrl(lobster.icon_url);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #fff9f3 0%, #fff 48%, #fff4e6 100%)",
          color: "#172033",
          fontFamily: "sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 24,
            borderRadius: 36,
            border: "3px solid #172033",
            opacity: 0.08,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 420,
            height: 420,
            right: -80,
            top: -120,
            borderRadius: 999,
            background: "radial-gradient(circle, rgba(255,139,61,0.22) 0%, rgba(255,139,61,0) 70%)",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            padding: "68px 74px",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 760,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: "#ff6b2c",
                marginBottom: 22,
              }}
            >
              {categoryLabel(lobster.category)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 72,
                lineHeight: 1.05,
                fontWeight: 800,
                letterSpacing: -2,
                marginBottom: 28,
              }}
            >
              {displayName}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 32,
                lineHeight: 1.35,
                color: "#4c566b",
                maxWidth: 740,
              }}
            >
              {summary}
            </div>
            <div
              style={{
                display: "flex",
                gap: 14,
                marginTop: "auto",
                flexWrap: "wrap",
              }}
            >
              {(lobster.topics?.slice(0, 3) || lobster.tags.slice(0, 3)).map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "#172033",
                    color: "#fff",
                    fontSize: 20,
                    fontWeight: 700,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              justifyContent: "space-between",
              width: 240,
            }}
          >
            <div
              style={{
                display: "flex",
                width: 168,
                height: 168,
                borderRadius: 32,
                background: "linear-gradient(145deg, #ff8238 0%, #ffb54d 100%)",
                border: "2px solid rgba(23,32,51,0.08)",
                alignItems: "center",
                justifyContent: "center",
                color: "#172033",
                fontSize: 88,
                fontWeight: 800,
                letterSpacing: -4,
                boxShadow: "0 18px 36px rgba(255,107,44,0.18)",
                overflow: "hidden",
              }}
            >
              {iconDataUrl ? (
                <img
                  src={iconDataUrl}
                  alt=""
                  width={168}
                  height={168}
                  style={{
                    display: "flex",
                    width: 168,
                    height: 168,
                    objectFit: "cover",
                  }}
                />
              ) : (
                badgeText
              )}
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 36,
                  fontWeight: 800,
                  color: "#172033",
                }}
              >
                {siteConfig.name}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: "#5f6b84",
                }}
              >
                clawlodge.com
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
