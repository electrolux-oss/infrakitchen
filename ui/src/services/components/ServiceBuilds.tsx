import { useCallback, useEffect, useMemo, useState } from "react";

import { PropertyCard } from "../../common/components/cards/PropertyCard";
import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { usePersistedPagination } from "../../common/hooks/usePersistedPagination";
import { LogsDialog } from "../../common/LogsComponent/LogsDialog";
import { CODE_FONT_FAMILY } from "../../common/theme";
import {
  Alert,
  Button,
  DataTable,
  DataTableColumn,
  RenderCellParams,
  Tooltip,
} from "../../ui";
import { GqlServiceBuild, SERVICE_BUILDS_QUERY } from "../graphql";

import { isActiveBuild } from "./ServiceCommits";

const ROWS_PER_PAGE_OPTIONS = [25, 50, 100];
const POLL_INTERVAL_MS = 5000;

const formatDuration = (build: GqlServiceBuild) => {
  if (!build.startedAt) return "";
  const end = build.finishedAt ? new Date(build.finishedAt) : new Date();
  const seconds = Math.max(
    0,
    Math.round((end.getTime() - new Date(build.startedAt).getTime()) / 1000),
  );
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};

export const ServiceBuilds = ({ serviceId }: { serviceId: string }) => {
  const { ikApi } = useConfig();
  const [paginationModel, setPaginationModel] = usePersistedPagination(
    "service_builds_pageSize",
    ROWS_PER_PAGE_OPTIONS[0],
    ROWS_PER_PAGE_OPTIONS,
  );
  const [builds, setBuilds] = useState<GqlServiceBuild[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logsBuild, setLogsBuild] = useState<GqlServiceBuild | null>(null);

  const load = useCallback(async () => {
    try {
      const start = paginationModel.page * paginationModel.pageSize;
      const response = await ikApi.graphqlRequest<{
        serviceBuilds: GqlServiceBuild[];
        serviceBuildsCount: number;
      }>(SERVICE_BUILDS_QUERY, {
        serviceId,
        range: [start, start + paginationModel.pageSize],
      });
      setBuilds(response.serviceBuilds || []);
      setCount(response.serviceBuildsCount ?? 0);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load builds");
    }
  }, [ikApi, serviceId, paginationModel]);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const hasActiveBuild = builds.some(isActiveBuild);
  useEffect(() => {
    if (!hasActiveBuild) return;
    const timer = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasActiveBuild, load]);

  const columns: DataTableColumn<GqlServiceBuild>[] = useMemo(
    () => [
      {
        field: "commitSha",
        headerName: "Commit",
        width: 100,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <span style={{ fontFamily: CODE_FONT_FAMILY }}>
            {params.row.commitSha.slice(0, 7)}
          </span>
        ),
      },
      {
        field: "version",
        headerName: "Version",
        width: 120,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) =>
          params.row.version ? (
            <span style={{ fontFamily: CODE_FONT_FAMILY }}>
              {params.row.version}
            </span>
          ) : null,
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <StatusLabel status={params.row.status} />
        ),
      },
      {
        field: "imageDigest",
        headerName: "Image",
        flex: 1,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => {
          const { image, imageDigest } = params.row;
          if (!image || !imageDigest) return null;
          return (
            <Tooltip title={`${image}@${imageDigest}`}>
              <span
                className="truncate"
                style={{ fontFamily: CODE_FONT_FAMILY }}
              >
                {imageDigest.slice(0, 19)}
              </span>
            </Tooltip>
          );
        },
      },
      {
        field: "duration",
        headerName: "Duration",
        width: 100,
        sortable: false,
        valueGetter: (_value: any, row: GqlServiceBuild) => formatDuration(row),
      },
      {
        field: "createdAt",
        headerName: "Started",
        width: 150,
        sortable: false,
        align: "right",
        headerAlign: "right",
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <div className="flex min-w-0 items-center justify-end gap-1.5">
            <RelativeTime date={params.row.createdAt} compact />
            <UserAvatar
              id={params.row.creator?.id}
              identifier={params.row.creator?.identifier}
            />
          </div>
        ),
      },
      {
        field: "logs",
        headerName: "",
        width: 80,
        sortable: false,
        align: "right",
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <Button variant="text" onClick={() => setLogsBuild(params.row)}>
            Logs
          </Button>
        ),
      },
    ],
    [],
  );

  if (!loading && !error && count === 0) {
    return (
      <Alert className="mt-2" severity="info">
        No builds yet. Start one from a commit on the Commits tab.
      </Alert>
    );
  }

  return (
    <PropertyCard title={null}>
      {error && <Alert severity="error">{error}</Alert>}
      <DataTable
        rows={builds}
        getRowId={(row) => row.id}
        columns={columns}
        loading={loading}
        paginationMode="server"
        rowCount={count}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={ROWS_PER_PAGE_OPTIONS}
      />
      {logsBuild && (
        <LogsDialog
          entityId={logsBuild.id}
          action="build"
          view="logs"
          onClose={() => setLogsBuild(null)}
        />
      )}
    </PropertyCard>
  );
};
