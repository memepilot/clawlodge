"use client";

import Image from "next/image";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const markdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "img", "picture", "source"],
  attributes: {
    ...defaultSchema.attributes,
    img: [
      ...(defaultSchema.attributes?.img || []),
      "src",
      "alt",
      "title",
      "width",
      "height",
      "loading",
      "decoding",
      "align",
    ],
    picture: [...(defaultSchema.attributes?.picture || [])],
    source: [
      ...(defaultSchema.attributes?.source || []),
      "src",
      "srcSet",
      "media",
      "type",
      "sizes",
    ],
    a: [...(defaultSchema.attributes?.a || []), "target", "rel"],
    p: [...(defaultSchema.attributes?.p || []), "align"],
  },
};

function isRenderableImageSource(src: string | undefined) {
  if (!src) return false;
  if (src.startsWith("data:image/")) return true;
  try {
    const normalized = new URL(src, "https://clawlodge.com");
    return /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(normalized.pathname);
  } catch {
    return /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(src);
  }
}

function isOptimizableImageSource(src: string | undefined) {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    const normalized = new URL(src, "https://clawlodge.com");
    return normalized.hostname === "clawlodge.com" || normalized.hostname === "avatars.githubusercontent.com" || normalized.hostname.endsWith(".githubusercontent.com");
  } catch {
    return false;
  }
}

function isSvgSource(src: string | undefined) {
  if (!src) return false;
  if (src.startsWith("data:image/svg+xml")) return true;
  try {
    const normalized = new URL(src, "https://clawlodge.com");
    return normalized.pathname.toLowerCase().endsWith(".svg");
  } catch {
    return src.toLowerCase().endsWith(".svg");
  }
}

function parseDimension(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d+)(?:px)?$/i);
    if (match) return Number(match[1]);
  }
  return null;
}

export function MarkdownContent({ value }: { value: string }) {
  return (
    <article className="markdown mt-4 text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSchema]]}
        components={{
          table: ({ children }) => (
            <div className="markdown-table-wrap">
              <table>{children}</table>
            </div>
          ),
          picture: ({ children }) => <>{children}</>,
          source: () => null,
          img: ({ src, alt, title, width, height }) => {
            const safeSrc = typeof src === "string" ? src : undefined;
            const safeAlt = alt?.trim() || title?.trim() || "README image";
            const parsedWidth = parseDimension(width);
            const parsedHeight = parseDimension(height);
            const usePlainImg = isSvgSource(safeSrc) && !parsedWidth && !parsedHeight;
            if (!isRenderableImageSource(safeSrc)) {
              return (
                <a
                  className="btn markdown-fallback-download"
                  href={safeSrc}
                  target="_blank"
                  rel="noreferrer"
                  title={title}
                >
                  {safeAlt || "Open attachment"}
                </a>
              );
            }

            if (!usePlainImg && isOptimizableImageSource(safeSrc) && parsedWidth && parsedHeight) {
              if (!safeSrc) return null;
              return (
                <Image
                  src={safeSrc}
                  alt={safeAlt}
                  title={title}
                  width={parsedWidth}
                  height={parsedHeight}
                  sizes="(max-width: 768px) 100vw, 768px"
                  quality={75}
                  style={{ width: "100%", maxWidth: `${parsedWidth}px`, height: "auto" }}
                />
              );
            }

            if (!usePlainImg && isOptimizableImageSource(safeSrc) && !parsedWidth && !parsedHeight) {
              if (!safeSrc) return null;
              return (
                <Image
                  src={safeSrc}
                  alt={safeAlt}
                  title={title}
                  width={1200}
                  height={675}
                  sizes="(max-width: 768px) 100vw, 768px"
                  quality={75}
                  style={{ width: "100%", height: "auto" }}
                />
              );
            }

            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeSrc}
                alt={safeAlt}
                title={title}
                width={typeof width === "number" || typeof width === "string" ? width : undefined}
                height={typeof height === "number" || typeof height === "string" ? height : undefined}
                loading="lazy"
                decoding="async"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  ...(parsedWidth ? { width: `${parsedWidth}px` } : null),
                }}
              />
            );
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </article>
  );
}
