import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Link } from "react-router-dom";
import { assetUrl } from "./data";
import { isValidElement, type ReactNode } from "react";
import { articleFigure } from "./ArticleFigures";
export default function Markdown({ body }: { body: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { plainText: ["site-chart"] }]]}
        components={{
          pre: ({ children }) => {
            if (
              isValidElement<{ className?: string; children?: ReactNode }>(
                children,
              ) &&
              children.props.className === "language-site-chart" &&
              typeof children.props.children === "string"
            ) {
              const figure = articleFigure(children.props.children.trim());
              if (figure) return figure;
            }
            return <pre>{children}</pre>;
          },
          h2: ({ children, ...props }) => (
            <h2 id={String(children).trim().replace(/\s+/g, "-")} {...props}>
              {children}
            </h2>
          ),
          a: ({ href, children }) =>
            href?.startsWith("/") &&
            !href.startsWith("//") &&
            !/\.(png|jpe?g|gif|webp|svg|pdf)([?#]|$)/i.test(href) ? (
              <Link to={href}>{children}</Link>
            ) : (
              <a
                href={href ? assetUrl(href) : undefined}
                target={href?.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
          img: ({ src, alt }) => (
            <img
              src={src ? assetUrl(src) : undefined}
              alt={alt || "文章配图"}
              loading="lazy"
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
