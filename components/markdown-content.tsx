"use client";

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

export function MarkdownContent({ value }: { value: string }) {
  return (
    <article className="markdown mt-4 text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSchema]]}
        components={{
          img: ({ src, alt, title }) => {
            const safeSrc = typeof src === "string" ? src : undefined;
            if (!isRenderableImageSource(safeSrc)) {
              return (
                <a
                  className="btn markdown-fallback-download"
                  href={safeSrc}
                  target="_blank"
                  rel="noreferrer"
                  title={title}
                >
                  {alt?.trim() || "Open attachment"}
                </a>
              );
            }

            return <img src={safeSrc} alt={alt || ""} title={title} loading="lazy" decoding="async" />;
          },
        }}
      >
        {value}
      </ReactMarkdown>
    </article>
  );
}
