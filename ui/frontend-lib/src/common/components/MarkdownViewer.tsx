import { FC } from "react";

import ReactMarkdown from "react-markdown";

import {
  Box,
  Link,
  SxProps,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Theme,
  Typography,
} from "@mui/material";
import remarkGfm from "remark-gfm";

import { InlineCode } from "./InlineCode";

interface MarkdownViewerProps {
  content: string;
  sx?: SxProps<Theme>;
}

/**
 * Renders Markdown content using MUI typography components.
 * Supports GitHub Flavored Markdown (tables, strikethrough, task lists).
 */
export const MarkdownViewer: FC<MarkdownViewerProps> = ({ content, sx }) => {
  return (
    <Box
      sx={{
        "& > *:first-of-type": { mt: 0 },
        "& > *:last-child": { mb: 0 },
        ...sx,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <Typography variant="h4" component="h1" sx={{ mt: 3, mb: 1.5 }}>
              {children}
            </Typography>
          ),
          h2: ({ children }) => (
            <Typography variant="h5" component="h2" sx={{ mt: 3, mb: 1.25 }}>
              {children}
            </Typography>
          ),
          h3: ({ children }) => (
            <Typography variant="h6" component="h3" sx={{ mt: 2.5, mb: 1 }}>
              {children}
            </Typography>
          ),
          h4: ({ children }) => (
            <Typography
              variant="subtitle1"
              component="h4"
              sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
            >
              {children}
            </Typography>
          ),
          h5: ({ children }) => (
            <Typography
              variant="subtitle2"
              component="h5"
              sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
            >
              {children}
            </Typography>
          ),
          h6: ({ children }) => (
            <Typography
              variant="subtitle2"
              component="h6"
              sx={{ mt: 2, mb: 0.75, fontWeight: 600 }}
            >
              {children}
            </Typography>
          ),
          p: ({ children }) => (
            <Typography variant="body1" sx={{ mb: 1.5, lineHeight: 1.7 }}>
              {children}
            </Typography>
          ),
          a: ({ href, children }) => (
            <Link href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </Link>
          ),
          ul: ({ children }) => (
            <Box component="ul" sx={{ pl: 3, mb: 1.5 }}>
              {children}
            </Box>
          ),
          ol: ({ children }) => (
            <Box component="ol" sx={{ pl: 3, mb: 1.5 }}>
              {children}
            </Box>
          ),
          li: ({ children }) => (
            <Box component="li" sx={{ mb: 0.5, lineHeight: 1.7 }}>
              {children}
            </Box>
          ),
          blockquote: ({ children }) => (
            <Box
              component="blockquote"
              sx={{
                borderLeft: 4,
                borderColor: "divider",
                pl: 2,
                ml: 0,
                my: 1.5,
                color: "text.secondary",
                fontStyle: "italic",
              }}
            >
              {children}
            </Box>
          ),
          code: ({ className, children }) => {
            const isBlock = /language-/.test(className || "");
            if (isBlock) {
              return (
                <Box
                  component="pre"
                  sx={{
                    backgroundColor: "action.hover",
                    borderRadius: 1,
                    p: 1.5,
                    overflow: "auto",
                    fontFamily: "'Roboto Mono', monospace",
                    fontSize: "0.85em",
                    mb: 1.5,
                  }}
                >
                  <Box component="code" sx={{ fontFamily: "inherit" }}>
                    {children}
                  </Box>
                </Box>
              );
            }
            return <InlineCode>{children}</InlineCode>;
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children }) => (
            <TableContainer sx={{ my: 1.5 }}>
              <Table size="small">{children}</Table>
            </TableContainer>
          ),
          thead: ({ children }) => <TableHead>{children}</TableHead>,
          tbody: ({ children }) => <TableBody>{children}</TableBody>,
          tr: ({ children }) => <TableRow>{children}</TableRow>,
          th: ({ children }) => (
            <TableCell sx={{ fontWeight: 600 }}>{children}</TableCell>
          ),
          td: ({ children }) => <TableCell>{children}</TableCell>,
          hr: () => (
            <Box
              component="hr"
              sx={{
                border: 0,
                borderTop: 1,
                borderColor: "divider",
                my: 2,
              }}
            />
          ),
          img: ({ src, alt }) => (
            <Box
              component="img"
              src={src}
              alt={alt}
              sx={{ maxWidth: "100%", height: "auto", borderRadius: 1 }}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};
