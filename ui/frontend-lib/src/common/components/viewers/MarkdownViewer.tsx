import { FC } from "react";

import ReactMarkdown from "react-markdown";

import remarkGfm from "remark-gfm";

import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Link,
} from "../../../ui";
import { cn } from "../../../utils/cn";
import { InlineCode } from "../code/InlineCode";

interface MarkdownViewerProps {
  content: string;
  className?: string;
  /** Hide the copy affordance on inline code (e.g. read-only contexts). */
  disableInlineCodeCopy?: boolean;
}

/**
 * Renders Markdown content with the app's typography styles.
 * Supports GitHub Flavored Markdown (tables, strikethrough, task lists).
 */
export const MarkdownViewer: FC<MarkdownViewerProps> = ({
  content,
  className,
  disableInlineCodeCopy = false,
}) => {
  return (
    <div
      className={cn(
        "[&>*:first-of-type]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="m-0 mt-6 mb-3 text-h5">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="m-0 mt-6 mb-2.5 text-h6">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="m-0 mt-5 mb-2 text-subtitle1 font-semibold text-grey-500">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="m-0 mt-4 mb-1.5 text-subtitle2 font-semibold text-grey-500">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="m-0 mt-4 mb-1.5 text-subtitle2 font-semibold text-grey-500">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="m-0 mt-4 mb-1.5 text-subtitle2 font-semibold text-grey-500">
              {children}
            </h6>
          ),
          p: ({ children }) => (
            <p className="m-0 mb-3 text-body2 leading-[1.7]">{children}</p>
          ),
          a: ({ href, children }) => (
            <Link href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </Link>
          ),
          ul: ({ children }) => <ul className="mb-3 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 pl-6">{children}</ol>,
          li: ({ children }) => (
            <li className="mb-1 leading-[1.7]">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 ml-0 border-l-4 border-divider pl-4 text-fg-muted italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <pre className="mb-3 overflow-auto rounded-code bg-hover p-3 font-mono text-[0.85em]">
                  <code className="font-[inherit]">{children}</code>
                </pre>
              );
            }
            return (
              <InlineCode disableCopy={disableInlineCodeCopy}>
                {children}
              </InlineCode>
            );
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <TableContainer className="my-3">
              <Table size="small">{children}</Table>
            </TableContainer>
          ),
          thead: ({ children }) => <TableHead>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => (
            <TableCell className="font-semibold">{children}</TableCell>
          ),
          td: ({ children }) => <TableCell>{children}</TableCell>,
          hr: () => <hr className="my-4 border-0 border-t border-divider" />,
          img: ({ src, alt }) => (
            <img
              className="h-auto max-w-full rounded-surface"
              src={src}
              alt={alt}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
