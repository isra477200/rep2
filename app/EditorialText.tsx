"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { Company } from "./data-types";

const editorialMarkdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), "details", "summary"],
  attributes: { ...defaultSchema.attributes, details: ["open"] },
};

const isPublicHref = (input?: string) => {
  if (!input) return false;
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();
    const privateIpv4 =
      /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        hostname,
      );
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !/(^|\.)notion\.(?:com|so|site)$/i.test(hostname) &&
      !/(^|\.)(?:localhost|local|internal)$/i.test(hostname) &&
      !privateIpv4
    );
  } catch {
    return false;
  }
};

export default function EditorialText({
  text,
  companyById,
  onOpen,
}: {
  text: string;
  companyById: Map<string, Company>;
  onOpen: (company: Company) => void;
}) {
  return (
    <div className="rich-text">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, editorialMarkdownSchema]]}
        components={{
          a: ({ href, children }) => {
            const internal = href?.match(/^\?empresa=([^&#]+)$/);
            if (internal) {
              const company = companyById.get(decodeURIComponent(internal[1]));
              return company ? (
                <a
                  href={href}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpen(company);
                  }}
                >
                  {children}
                </a>
              ) : (
                <span>{children}</span>
              );
            }
            return isPublicHref(href) ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children} ↗
              </a>
            ) : (
              <span>{children}</span>
            );
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
