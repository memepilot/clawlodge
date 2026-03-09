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

export function MarkdownContent({ value }: { value: string }) {
  return (
    <article className="markdown mt-4 text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeRaw], [rehypeSanitize, markdownSchema]]}>
        {value}
      </ReactMarkdown>
    </article>
  );
}
