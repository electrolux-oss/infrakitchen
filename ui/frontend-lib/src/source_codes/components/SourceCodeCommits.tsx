import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "react-router";

import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import {
  Alert,
  Box,
  Chip,
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
} from "@mui/material";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { Entity } from "../../common/components/entities/Entity";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { notifyError } from "../../common/hooks/useNotification";
import {
  GqlSourceCodeCommit,
  GqlSourceCodeTag,
  SOURCE_CODE_COMMIT_INDEX_QUERY,
  SOURCE_CODE_COMMITS_QUERY,
} from "../graphql";

import { CopyButton } from "./CopyButton";
import { SourceCodeCommitMessage } from "./SourceCodeCommitMessage";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const SHA_PARAM = "sha";

const commitLink = (sha: string): string => {
  const url = new URL(window.location.href);
  url.searchParams.set(SHA_PARAM, sha);
  return url.toString();
};

interface SourceCodeCommitsProps {
  sourceCodeId: string;
  branch: string | null;
  total: number;
  tags: GqlSourceCodeTag[];
}

export const SourceCodeCommits = ({
  sourceCodeId,
  branch,
  total,
  tags,
}: SourceCodeCommitsProps) => {
  const { ikApi } = useConfig();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
  const [commits, setCommits] = useState<GqlSourceCodeCommit[]>([]);
  const [count, setCount] = useState(total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<GqlSourceCodeTag | null>(null);
  const highlightedSha = searchParams.get(SHA_PARAM);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const tagsBySha = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tag of tags) {
      map.set(tag.sha, [...(map.get(tag.sha) ?? []), tag.name]);
    }
    return map;
  }, [tags]);

  const setHighlightedSha = useCallback(
    (sha: string | null) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          if (sha) next.set(SHA_PARAM, sha);
          else next.delete(SHA_PARAM);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const start = page * rowsPerPage;
        const response = await ikApi.graphqlRequest<{
          sourceCodeCommits: GqlSourceCodeCommit[];
          sourceCodeCommitsCount: number;
        }>(SOURCE_CODE_COMMITS_QUERY, {
          id: sourceCodeId,
          branch,
          range: [start, start + rowsPerPage],
        });
        if (!cancelled) {
          setCommits(response.sourceCodeCommits || []);
          setCount(response.sourceCodeCommitsCount ?? 0);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load commits");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [ikApi, sourceCodeId, branch, page, rowsPerPage, total]);

  useEffect(() => {
    if (!loading && highlightedSha) {
      highlightedRowRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [loading, highlightedSha, commits]);

  const jumpToCommit = useCallback(
    async (sha: string, notFoundMessage: string) => {
      try {
        const response = await ikApi.graphqlRequest<{
          sourceCodeCommitIndex: number | null;
        }>(SOURCE_CODE_COMMIT_INDEX_QUERY, {
          id: sourceCodeId,
          sha,
          branch,
        });
        const index = response.sourceCodeCommitIndex;
        if (index === null || index === undefined) {
          notifyError(new Error(notFoundMessage));
          return;
        }
        setHighlightedSha(sha);
        setPage(Math.floor(index / rowsPerPage));
      } catch (e) {
        notifyError(e);
      }
    },
    [ikApi, sourceCodeId, branch, rowsPerPage, setHighlightedSha],
  );

  // A shared link opens the page of its commit.
  const initialSha = useRef(highlightedSha);
  useEffect(() => {
    if (initialSha.current) {
      void jumpToCommit(
        initialSha.current,
        `Commit ${initialSha.current.slice(0, 7)} is not on ${branch}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTag = (tag: GqlSourceCodeTag | null) => {
    setSelectedTag(tag);
    if (!tag) {
      setHighlightedSha(null);
      return;
    }
    void jumpToCommit(
      tag.sha,
      `Tag ${tag.name} points to a commit that is not in this list`,
    );
  };

  return (
    <PropertyCard
      title="Commits"
      subtitle={`${total} commits on ${branch}, as of the last sync`}
      action={
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            pt: 1.5,
            pr: 1,
          }}
        >
          {tags.length > 0 && (
            <TextField
              select
              size="small"
              label="Jump to tag"
              sx={{ width: 200 }}
              value={selectedTag?.name ?? ""}
              onChange={(e) =>
                selectTag(
                  tags.find((tag) => tag.name === e.target.value) ?? null,
                )
              }
              slotProps={{
                htmlInput: { "aria-label": "Jump to tag" },
                select: {
                  MenuProps: {
                    slotProps: { paper: { sx: { maxHeight: 360 } } },
                  },
                },
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {tags.map((tag) => (
                <MenuItem
                  key={tag.name}
                  value={tag.name}
                  sx={{ fontFamily: "monospace" }}
                >
                  {tag.name}
                </MenuItem>
              ))}
            </TextField>
          )}
        </Box>
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      <Table size="small" sx={{ opacity: loading ? 0.5 : 1 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 150 }}>Commit</TableCell>
            <TableCell>Message</TableCell>
            <TableCell sx={{ width: 200 }}>Author</TableCell>
            <TableCell sx={{ width: 160 }}>Date</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {commits.map((commit) => {
            const highlighted = commit.sha === highlightedSha;
            return (
              <TableRow
                key={commit.sha}
                ref={highlighted ? highlightedRowRef : undefined}
                selected={highlighted}
              >
                <TableCell sx={{ fontFamily: "monospace" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {commit.url ? (
                      <Link
                        href={commit.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {commit.shortSha}
                      </Link>
                    ) : (
                      commit.shortSha
                    )}
                    <CopyButton value={commit.sha} label="Copy SHA" />
                    <CopyButton
                      value={() => commitLink(commit.sha)}
                      label="Copy link to this commit"
                      variant="link"
                      onCopied={() => setHighlightedSha(commit.sha)}
                    />
                  </Box>
                </TableCell>
                <TableCell sx={{ wordBreak: "break-word" }}>
                  <SourceCodeCommitMessage
                    commit={commit}
                    adornments={tagsBySha.get(commit.sha)?.map((tag) => (
                      <Chip
                        key={tag}
                        icon={<LocalOfferOutlinedIcon />}
                        label={tag}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontFamily: "monospace" }}
                      />
                    ))}
                  />
                </TableCell>
                <TableCell>
                  {commit.author ? (
                    <Entity
                      entity={{
                        ...commit.author,
                        entityType: "user",
                        name: commit.authorName,
                      }}
                      hideName
                    />
                  ) : (
                    <Tooltip title={commit.authorEmail}>
                      <span>{commit.authorName}</span>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell>
                  <RelativeTime date={commit.authoredAt} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={(_, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
        sx={{ borderTop: 1, borderColor: "divider", mt: 1 }}
      />
    </PropertyCard>
  );
};
