import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSearchParams } from "react-router";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notifyError } from "../../common/hooks/useNotification";
import { usePersistedPagination } from "../../common/hooks/usePersistedPagination";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { HeroTagIcon } from "../../icons";
import { Alert, Link } from "../../ui";
import { DataTable, DataTableColumn, RenderCellParams } from "../../ui";
import { cn } from "../../utils/cn";
import {
  GqlSourceCodeCommit,
  GqlSourceCodeTag,
  SOURCE_CODE_COMMIT_INDEX_QUERY,
  SOURCE_CODE_COMMITS_QUERY,
} from "../graphql";

import { SourceCodeCommitMessage } from "./SourceCodeCommitMessage";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const SHA_PARAM = "sha";

/**
 * Git tag rendered like Template Versions row labels: the outlined tag icon
 * followed by the plain tag name.
 */
export const TagChip = ({ tag }: { tag: string }) => {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <HeroTagIcon className="shrink-0 text-[16px]" color="action" />
      <span>{tag}</span>
    </div>
  );
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
  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "source_code_commits_pageSize",
    ROWS_PER_PAGE_OPTIONS[0],
    ROWS_PER_PAGE_OPTIONS,
  );
  const [commits, setCommits] = useState<GqlSourceCodeCommit[]>([]);
  const [count, setCount] = useState(total);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const highlightedSha = searchParams.get(SHA_PARAM);
  const highlightedRowRef = useRef<HTMLElement | null>(null);

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
        const start = paginationModel.page * paginationModel.pageSize;
        const response = await ikApi.graphqlRequest<{
          sourceCodeCommits: GqlSourceCodeCommit[];
          sourceCodeCommitsCount: number;
        }>(SOURCE_CODE_COMMITS_QUERY, {
          id: sourceCodeId,
          branch,
          range: [start, start + paginationModel.pageSize],
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
  }, [ikApi, sourceCodeId, branch, paginationModel, total]);

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
        setPaginationModel((prev) => ({
          ...prev,
          page: Math.floor(index / prev.pageSize),
        }));
      } catch (e) {
        notifyError(e);
      }
    },
    [ikApi, sourceCodeId, branch, setHighlightedSha, setPaginationModel],
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

  const lastSyncedAt = useEntityProvider().entity?.updatedAt;

  const columns: DataTableColumn<GqlSourceCodeCommit>[] = useMemo(
    () => [
      {
        field: "shortSha",
        headerName: "Commit",
        width: 100,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlSourceCodeCommit>) => {
          const commit = params.row;
          const shaText = (
            <span style={{ fontFamily: CODE_FONT_FAMILY }}>
              {commit.shortSha}
            </span>
          );
          return commit.url ? (
            <Link href={commit.url} target="_blank" rel="noopener noreferrer">
              {shaText}
            </Link>
          ) : (
            shaText
          );
        },
      },
      {
        field: "message",
        headerName: "Message",
        flex: 1,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlSourceCodeCommit>) => (
          <SourceCodeCommitMessage commit={params.row} />
        ),
      },
      {
        field: "tags",
        headerName: "Tags",
        width: 160,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlSourceCodeCommit>) => (
          <div className="flex flex-wrap gap-2">
            {(tagsBySha.get(params.row.sha) ?? []).map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        ),
      },
      {
        field: "authoredAt",
        headerName: "Date",
        width: 150,
        sortable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams<GqlSourceCodeCommit>) => {
          const commit = params.row;
          return (
            <div className="flex min-w-0 items-center justify-end gap-1.5">
              <RelativeTime date={commit.authoredAt} compact />
              <UserAvatar
                id={commit.author?.id}
                identifier={commit.author?.identifier ?? commit.authorName}
              />
            </div>
          );
        },
      },
    ],
    [tagsBySha],
  );

  if (!branch) {
    return (
      <Alert className="mt-2" severity="info">
        This repository has not been synced yet. Trigger a sync to load commits.
      </Alert>
    );
  }

  return (
    <PropertyCard
      title={null}
      subtitle={
        <div className="inline-flex items-baseline gap-1">
          <span>{`${total} commits on the ${branch} branch, synced`}</span>
          {lastSyncedAt && (
            <span>
              <RelativeTime date={lastSyncedAt} />.
            </span>
          )}
        </div>
      }
    >
      {error && <Alert severity="error">{error}</Alert>}
      <div className={cn(loading ? "opacity-50" : "opacity-100")}>
        <DataTable
          rows={commits}
          getRowId={(row) => row.sha}
          columns={columns}
          loading={loading}
          paginationMode="server"
          rowCount={count}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={ROWS_PER_PAGE_OPTIONS}
        />
      </div>
    </PropertyCard>
  );
};
