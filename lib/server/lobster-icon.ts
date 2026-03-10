import { ApiError } from "./errors";
import { sha256 } from "./utils";

const PROCEDURAL_ICON_SPEC_VERSION = "procedural-v1";
const NANOBANA_ICON_SPEC_VERSION = "nanobana-v1";
const ICON_SIZE = 256;
const MAX_README_PROMPT_CHARS = 200;
const DEFAULT_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";

type IconSourceType = "official" | "curated" | "community" | "demo";

export type IconSignals = {
  slug: string;
  version: string;
  tags: string[];
  sourceType: IconSourceType;
  workspacePaths: string[];
  readmeText?: string;
  summary?: string;
};

type Palette = {
  shell: string;
  shellShade: string;
  shellHighlight: string;
  outline: string;
  badge: string;
  eye: string;
  background: string;
};

const PALETTES: Palette[] = [
  { shell: "#ff7b5d", shellShade: "#dd503b", shellHighlight: "#ffb39a", outline: "#4f2018", badge: "#1d8f86", eye: "#241815", background: "#fff4ee" },
  { shell: "#ff9864", shellShade: "#d8653f", shellHighlight: "#ffd0b0", outline: "#4e2a16", badge: "#4b7ee8", eye: "#1f1712", background: "#fff7ef" },
  { shell: "#f36e78", shellShade: "#c94958", shellHighlight: "#ffb8be", outline: "#4e1b26", badge: "#7567ff", eye: "#211317", background: "#fff2f4" },
  { shell: "#ff8a95", shellShade: "#d2535f", shellHighlight: "#ffc2c8", outline: "#532029", badge: "#1f9a64", eye: "#1f1316", background: "#fff4f5" },
];

function hashInt(seed: string, start: number, length = 2) {
  return parseInt(seed.slice(start, start + length), 16);
}

function pick<T>(seed: string, start: number, values: T[]) {
  return values[hashInt(seed, start) % values.length];
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hasPath(paths: string[], prefix: string) {
  return paths.some((path) => path === prefix || path.startsWith(`${prefix}/`));
}

function buildBadgeMotif(sourceType: IconSourceType, paths: string[]) {
  if (hasPath(paths, "skills")) return "skill";
  if (hasPath(paths, "memory")) return "memory";
  if (hasPath(paths, "workflows")) return "workflow";
  if (hasPath(paths, "docs")) return "docs";
  if (hasPath(paths, "devops")) return "devops";
  if (sourceType === "official") return "official";
  if (sourceType === "curated") return "curated";
  if (sourceType === "demo") return "demo";
  return "community";
}

function badgeMarkup(motif: string, color: string) {
  switch (motif) {
    case "skill":
      return `<path d="M180 187l10-18 20 5-14-15 11-18-19 8-14-15 2 20-19 8 20 4 3 21z" fill="${color}" opacity=".95"/>`;
    case "memory":
      return `<path d="M168 144c0-10 8-18 18-18s18 8 18 18c0 12-18 31-18 31s-18-19-18-31z" fill="${color}"/><circle cx="186" cy="144" r="7" fill="#fff" opacity=".85"/>`;
    case "workflow":
      return `<path d="M165 143h39M196 132l11 11-11 11M166 176h29M166 110h29" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    case "docs":
      return `<rect x="166" y="123" width="36" height="46" rx="8" fill="${color}"/><path d="M176 136h16M176 147h16M176 158h11" stroke="#fff" stroke-width="6" stroke-linecap="round"/>`;
    case "devops":
      return `<circle cx="186" cy="146" r="16" fill="none" stroke="${color}" stroke-width="8"/><path d="M186 122v-12M186 182v-12M162 146h-12M222 146h-12M169 129l-8-8M211 171l-8-8M203 129l8-8M161 171l8-8" stroke="${color}" stroke-width="6" stroke-linecap="round"/>`;
    case "official":
      return `<path d="M186 117l10 20 22 3-16 15 4 22-20-10-20 10 4-22-16-15 22-3z" fill="${color}"/>`;
    case "curated":
      return `<path d="M169 126h34v40h-34z" fill="${color}"/><path d="M169 140h34M186 126v40" stroke="#fff" stroke-width="7"/>`;
    case "demo":
      return `<path d="M174 126l26 20-26 20z" fill="${color}"/>`;
    default:
      return `<circle cx="186" cy="146" r="18" fill="${color}"/><circle cx="178" cy="142" r="3" fill="#fff"/><circle cx="194" cy="142" r="3" fill="#fff"/>`;
  }
}

function sanitizeReadmeExcerpt(readmeText?: string) {
  return (readmeText || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/`{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_README_PROMPT_CHARS);
}

function buildImageDirection(signals: IconSignals) {
  const cues: string[] = [];
  if (hasPath(signals.workspacePaths, "skills")) cues.push("skillful");
  if (hasPath(signals.workspacePaths, "memory")) cues.push("memory-oriented");
  if (hasPath(signals.workspacePaths, "workflows")) cues.push("workflow-heavy");
  if (hasPath(signals.workspacePaths, "docs")) cues.push("documentation-rich");
  if (hasPath(signals.workspacePaths, "devops")) cues.push("infrastructure-flavored");
  if (!cues.length) cues.push("general-purpose");
  return cues.join(", ");
}

function getLlmApiKey() {
  return process.env.LLM_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
}

function getLlmApiUrl() {
  return process.env.LLM_API_URL?.trim() || DEFAULT_CHAT_COMPLETIONS_URL;
}

async function generateOpenRouterIconPrompt(signals: IconSignals) {
  const apiKey = getLlmApiKey();
  if (!apiKey) {
    throw new ApiError(500, "Icon prompt generation is unavailable because no LLM API key is configured");
  }

  const readmeExcerpt = sanitizeReadmeExcerpt(signals.readmeText);
  const response = await fetch(getLlmApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: process.env.CLAWLODGE_ICON_PROMPT_MODEL?.trim() || process.env.CLAWLODGE_README_MODEL?.trim() || "openai/gpt-4.1",
      messages: [
        {
          role: "system",
          content:
            "You write one concise image-generation prompt for a square UI icon. Return plain text only. The subject must always be a single lobster mascot. Emphasize silhouette, personality, and workspace-specific props or mood. Keep it under 90 words. No markdown.",
        },
        {
          role: "user",
          content: [
            `Workspace slug: ${signals.slug}`,
            `Version: ${signals.version}`,
            `Source type: ${signals.sourceType}`,
            `Tags: ${signals.tags.join(", ") || "none"}`,
            `Workspace shape: ${buildImageDirection(signals)}`,
            signals.summary ? `Summary: ${signals.summary}` : "",
            readmeExcerpt ? `README excerpt: ${readmeExcerpt}` : "",
            "",
            "Write a prompt for a distinct square icon: one stylized lobster, solid white background, suitable for a product card, crisp edges, readable at small size, bold silhouette, no text. Target a compact 256x256 app-icon source image.",
          ].filter(Boolean).join("\n"),
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, body?.error?.message || body?.detail || `OpenRouter prompt generation failed: ${response.status}`);
  }

  const prompt = typeof body?.choices?.[0]?.message?.content === "string"
    ? body.choices[0].message.content.replace(/\s+/g, " ").trim()
    : "";
  if (!prompt) {
    throw new ApiError(502, "OpenRouter icon prompt generation returned an empty response");
  }
  return prompt;
}

function parseDataUrl(value: string) {
  const match = value.match(/^data:([^;,]+)?;base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1] || "application/octet-stream",
    body: Buffer.from(match[2], "base64"),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function toDataUrl(base64Value: string, mimeType = "image/png") {
  const cleaned = base64Value.replace(/\s+/g, "").trim();
  if (cleaned.length < 64) return null;
  return `data:${mimeType};base64,${cleaned}`;
}

function isAbsoluteAssetUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" || url.protocol === "data:";
  } catch {
    return false;
  }
}

function extractUrlFromText(text: string) {
  const normalized = text.trim();
  if (!normalized) return null;

  const dataUrlMatch = normalized.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/);
  if (dataUrlMatch?.[0] && isAbsoluteAssetUrl(dataUrlMatch[0])) {
    return dataUrlMatch[0];
  }

  const urlMatch = normalized.match(/https?:\/\/\S+/i)?.[0];
  if (urlMatch && isAbsoluteAssetUrl(urlMatch)) {
    return urlMatch;
  }

  return null;
}

function extractAssetCandidate(value: unknown): string | null {
  if (typeof value === "string") {
    if (isAbsoluteAssetUrl(value)) return value;
    return extractUrlFromText(value);
  }

  const record = asRecord(value);
  if (!record) return null;

  const imageUrlField = record.image_url;
  if (typeof imageUrlField === "string" && isAbsoluteAssetUrl(imageUrlField)) {
    return imageUrlField;
  }
  const imageUrlObj = asRecord(imageUrlField);
  if (typeof imageUrlObj?.url === "string" && isAbsoluteAssetUrl(imageUrlObj.url)) {
    return imageUrlObj.url;
  }

  const camelImageUrl = asRecord(record.imageUrl);
  if (typeof camelImageUrl?.url === "string" && isAbsoluteAssetUrl(camelImageUrl.url)) {
    return camelImageUrl.url;
  }

  if (typeof record.url === "string" && isAbsoluteAssetUrl(record.url)) {
    return record.url;
  }

  if (typeof record.asset_url === "string" && isAbsoluteAssetUrl(record.asset_url)) {
    return record.asset_url;
  }

  if (typeof record.b64_json === "string") {
    return toDataUrl(record.b64_json, typeof record.mime_type === "string" ? record.mime_type : "image/png");
  }
  if (typeof record.base64 === "string") {
    return toDataUrl(record.base64, typeof record.mime_type === "string" ? record.mime_type : "image/png");
  }

  const inlineData = asRecord(record.inlineData);
  if (typeof inlineData?.data === "string") {
    return toDataUrl(inlineData.data, typeof inlineData.mimeType === "string" ? inlineData.mimeType : "image/png");
  }

  if (typeof record.text === "string") {
    return extractUrlFromText(record.text);
  }

  return null;
}

async function resolveRemoteAsset(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new ApiError(502, `Failed to fetch generated icon asset: ${response.status}`);
  return {
    body: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}

async function parseNanobanaAsset(body: unknown) {
  const payload = asRecord(body) ?? {};
  const candidates: string[] = [];

  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = asRecord(choices[0]) ?? {};
  const firstMessage = asRecord(firstChoice.message) ?? {};
  const messageImages = firstMessage.images;
  if (Array.isArray(messageImages)) {
    for (const item of messageImages) {
      const candidate = extractAssetCandidate(item);
      if (candidate) candidates.push(candidate);
    }
  }

  const messageContent = firstMessage.content;
  if (Array.isArray(messageContent)) {
    for (const item of messageContent) {
      const candidate = extractAssetCandidate(item);
      if (candidate) candidates.push(candidate);
    }
  } else {
    const candidate = extractAssetCandidate(messageContent);
    if (candidate) candidates.push(candidate);
  }

  const bucketCandidates = [payload.data, payload.images];
  for (const bucket of bucketCandidates) {
    if (Array.isArray(bucket)) {
      for (const item of bucket) {
        const candidate = extractAssetCandidate(item);
        if (candidate) candidates.push(candidate);
      }
    } else {
      const candidate = extractAssetCandidate(bucket);
      if (candidate) candidates.push(candidate);
    }
  }

  if (Array.isArray(payload.output)) {
    for (const outputItem of payload.output) {
      const content = outputItem?.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          const candidate = extractAssetCandidate(item);
          if (candidate) candidates.push(candidate);
        }
      } else {
        const candidate = extractAssetCandidate(content);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  for (const candidate of candidates) {
    const dataUrl = parseDataUrl(candidate);
    if (dataUrl) return dataUrl;
    if (isAbsoluteAssetUrl(candidate)) return resolveRemoteAsset(candidate);
  }

  const base64Payload = [
    payload.base64,
    payload.image_base64,
    asRecord(payload.asset)?.base64,
    Array.isArray(payload.data) ? asRecord(payload.data[0])?.base64 : undefined,
  ].find((value) => typeof value === "string") as string | undefined;

  if (base64Payload) {
    return {
      body: Buffer.from(base64Payload, "base64"),
      contentType:
        (typeof payload.content_type === "string" ? payload.content_type : undefined) ||
        (typeof payload.mime_type === "string" ? payload.mime_type : undefined) ||
        (typeof asRecord(payload.asset)?.content_type === "string" ? asRecord(payload.asset)?.content_type : undefined) ||
        (Array.isArray(payload.data) && typeof asRecord(payload.data[0])?.content_type === "string"
          ? asRecord(payload.data[0])?.content_type
          : undefined) ||
        "image/png",
    };
  }

  throw new ApiError(502, "Nanobana asset response did not include a usable image");
}

export function iconExtensionForContentType(contentType: string) {
  const normalized = contentType.toLowerCase();
  if (normalized.includes("image/svg+xml")) return "svg";
  if (normalized.includes("image/png")) return "png";
  if (normalized.includes("image/webp")) return "webp";
  if (normalized.includes("image/jpeg")) return "jpg";
  if (normalized.includes("image/gif")) return "gif";
  return "bin";
}

async function renderNanobanaIcon(prompt: string) {
  const apiKey = getLlmApiKey();
  if (!apiKey) {
    throw new ApiError(500, "Nanobana image generation is unavailable because no LLM API key is configured");
  }

  const response = await fetch(getLlmApiUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.APP_ORIGIN?.trim() || "https://clawlodge.com",
      "X-Title": "ClawLodge",
    },
    body: JSON.stringify({
      model: process.env.CLAWLODGE_ICON_IMAGE_MODEL?.trim() || process.env.NANO_BANANA_MODEL?.trim() || "google/gemini-2.5-flash-image",
      stream: false,
      modalities: ["image", "text"],
      messages: [
        {
          role: "user",
          content: [
            prompt,
            "Format: square 1:1 icon.",
            "Target size: a compact 256x256 source image intended for 56px, 84px, and 112px UI rendering.",
            "Background: solid white background only.",
            "Output: one polished lobster icon only.",
            "Do not render any text or letters.",
          ].join("\n"),
        },
      ],
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(502, body?.error?.message || body?.detail || `Nanobana image generation failed: ${response.status}`);
  }
  return parseNanobanaAsset(body);
}

export function generateProceduralLobsterIcon(signals: IconSignals) {
  const seed = sha256(
    JSON.stringify({
      slug: signals.slug,
      version: signals.version,
      tags: [...signals.tags].sort(),
      sourceType: signals.sourceType,
      workspacePaths: [...signals.workspacePaths].sort(),
      spec: PROCEDURAL_ICON_SPEC_VERSION,
    }),
  );

  const palette = pick(seed, 0, PALETTES);
  const bodyScaleX = 1 + (hashInt(seed, 2) % 18) / 100;
  const bodyScaleY = 1 + (hashInt(seed, 4) % 15) / 100;
  const bodyRotate = (hashInt(seed, 6) % 7) - 3;
  const clawSpread = 54 + (hashInt(seed, 8) % 12);
  const clawTilt = 18 + (hashInt(seed, 10) % 18);
  const antennaHeight = 28 + (hashInt(seed, 12) % 24);
  const eyeOffset = 18 + (hashInt(seed, 14) % 5);
  const tailFan = 28 + (hashInt(seed, 16) % 12);
  const segmentCount = 3 + (hashInt(seed, 18) % 3);
  const legLift = 10 + (hashInt(seed, 20) % 10);
  const clawType = hashInt(seed, 22) % 3;
  const motif = buildBadgeMotif(signals.sourceType, signals.workspacePaths);
  const badge = badgeMarkup(motif, palette.badge);
  const ringDash = 160 + (hashInt(seed, 24) % 48);
  const shellSegments = Array.from({ length: segmentCount }, (_, index) => {
    const x = 102 + index * 18;
    const y = 118 + (index % 2 === 0 ? 0 : 2);
    const width = 22 - index * 1.5;
    const height = 56 - index * 4;
    return `<ellipse cx="${x}" cy="${y}" rx="${width}" ry="${height / 2}" fill="${palette.shellHighlight}" opacity="${0.16 + index * 0.05}"/>`;
  }).join("");

  const legs = Array.from({ length: 3 }, (_, index) => {
    const y = 164 + index * 8;
    const x1 = 104 + index * 16;
    const x2 = 85 + index * 11;
    const x3 = 73 + index * 8;
    const mirroredX1 = 152 - index * 16;
    const mirroredX2 = 171 - index * 11;
    const mirroredX3 = 183 - index * 8;
    return [
      `<path d="M${x1} ${y} C${x2} ${y + 10}, ${x3} ${y + legLift}, ${x3 - 6} ${y + 26}" stroke="${palette.outline}" stroke-width="6.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
      `<path d="M${mirroredX1} ${y} C${mirroredX2} ${y + 10}, ${mirroredX3} ${y + legLift}, ${mirroredX3 + 6} ${y + 26}" stroke="${palette.outline}" stroke-width="6.5" stroke-linecap="round" fill="none" opacity=".85"/>`,
    ].join("");
  }).join("");

  const leftClaw = [
    `M64 97 C47 84, 39 66, 46 53 C58 51, 70 56, 79 68 C84 78, 82 88, 74 98 L89 105 C76 111, 67 108, 64 97 Z`,
    `M63 102 C46 93, 38 76, 42 60 C52 56, 65 58, 77 67 C85 77, 84 91, 78 101 L92 111 C80 117, 69 115, 63 102 Z`,
    `M61 101 C46 88, 40 71, 48 57 C60 57, 72 62, 80 74 C84 84, 82 95, 73 104 L86 114 C73 117, 65 113, 61 101 Z`,
  ][clawType];

  const slugInitial = escapeXml(signals.slug.slice(0, 1).toUpperCase() || "C");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" fill="none" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(signals.slug)} workspace lobster icon</title>
  <desc id="desc">Procedurally generated ClawLodge lobster avatar for ${escapeXml(signals.slug)} ${escapeXml(signals.version)}.</desc>
  <rect width="${ICON_SIZE}" height="${ICON_SIZE}" rx="52" fill="${palette.background}"/>
  <circle cx="128" cy="128" r="100" fill="none" stroke="${palette.outline}" stroke-width="4" stroke-dasharray="${ringDash} 14" opacity=".12"/>
  <circle cx="128" cy="128" r="90" fill="#fff" opacity=".7"/>
  <g transform="rotate(${bodyRotate} 128 128)">
    <path d="M93 79 C77 56, 67 37, 63 19" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M163 79 C179 56, 189 37, 193 19" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M93 80 C80 ${76 - antennaHeight}, 66 ${56 - antennaHeight}, 56 ${34 - antennaHeight}" stroke="${palette.shellHighlight}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M163 80 C176 ${76 - antennaHeight}, 190 ${56 - antennaHeight}, 200 ${34 - antennaHeight}" stroke="${palette.shellHighlight}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M78 ${120 - clawTilt} C65 111, 50 107, ${128 - clawSpread} 105" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M178 ${120 - clawTilt} C191 111, 206 107, ${128 + clawSpread} 105" stroke="${palette.outline}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="${leftClaw}" fill="${palette.shell}" stroke="${palette.outline}" stroke-width="5"/>
    <path d="M192 97 C209 84, 217 66, 210 53 C198 51, 186 56, 177 68 C172 78, 174 88, 182 98 L167 105 C180 111, 189 108, 192 97 Z" fill="${palette.shell}" stroke="${palette.outline}" stroke-width="5"/>
    <g transform="translate(128 130) scale(${bodyScaleX} ${bodyScaleY})">
      <ellipse cx="0" cy="0" rx="41" ry="56" fill="${palette.shell}" stroke="${palette.outline}" stroke-width="6"/>
      <ellipse cx="0" cy="-6" rx="24" ry="34" fill="${palette.shellShade}" opacity=".22"/>
      ${shellSegments}
      <path d="M-30 45 C-14 ${58 + tailFan / 3}, 14 ${58 + tailFan / 3}, 30 45" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round" fill="none"/>
      <path d="M-16 53 L0 ${70 + tailFan / 5} L16 53" stroke="${palette.outline}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    ${legs}
    <circle cx="${128 - eyeOffset}" cy="96" r="7" fill="${palette.eye}"/>
    <circle cx="${128 + eyeOffset}" cy="96" r="7" fill="${palette.eye}"/>
    <circle cx="${128 - eyeOffset - 2}" cy="94" r="2.4" fill="#fff" opacity=".9"/>
    <circle cx="${128 + eyeOffset - 2}" cy="94" r="2.4" fill="#fff" opacity=".9"/>
    <path d="M114 118 C123 125, 133 125, 142 118" stroke="${palette.outline}" stroke-width="4" stroke-linecap="round" fill="none" opacity=".85"/>
  </g>
  <g>
    <circle cx="186" cy="146" r="30" fill="#fff" opacity=".92"/>
    <circle cx="186" cy="146" r="30" fill="none" stroke="${palette.outline}" stroke-width="4" opacity=".18"/>
    ${badge}
  </g>
  <g transform="translate(32 188)">
    <rect width="52" height="36" rx="18" fill="${palette.outline}" opacity=".08"/>
    <text x="26" y="24" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="${palette.outline}" opacity=".6">${slugInitial}</text>
  </g>
</svg>`;

  return {
    body: Buffer.from(svg, "utf8"),
    contentType: "image/svg+xml",
    seed,
    specVersion: PROCEDURAL_ICON_SPEC_VERSION,
    prompt: null,
  };
}

export async function generateWorkspaceLobsterIcon(signals: IconSignals) {
  try {
    const prompt = await generateOpenRouterIconPrompt(signals);
    const asset = await renderNanobanaIcon(prompt);
    return {
      body: asset.body,
      contentType: asset.contentType,
      seed: sha256(`${signals.slug}:${signals.version}:${prompt}`),
      specVersion: NANOBANA_ICON_SPEC_VERSION,
      prompt,
    };
  } catch {
    return generateProceduralLobsterIcon(signals);
  }
}
