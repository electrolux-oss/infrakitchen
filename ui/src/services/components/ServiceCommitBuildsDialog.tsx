import { useMemo, useState } from "react";

import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { EntityReference } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { LogsDialog } from "../../common/LogsComponent/LogsDialog";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { GqlSourceCodeCommit } from "../../source_codes/graphql";
import {
  Button,
  DataTable,
  DataTableColumn,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  RenderCellParams,
  Tooltip,
} from "../../ui";
import { GqlServiceBuild } from "../graphql";

import { formatDuration } from "./builds";

interface ServiceCommitBuildsDialogProps {
  commit: GqlSourceCodeCommit;
  builds: GqlServiceBuild[];
  onClose: () => void;
}

export const ServiceCommitBuildsDialog = ({
  commit,
  builds,
  onClose,
}: ServiceCommitBuildsDialogProps) => {
  const [logsBuild, setLogsBuild] = useState<GqlServiceBuild | null>(null);

  const columns: DataTableColumn<GqlServiceBuild>[] = useMemo(
    () => [
      {
        field: "tag",
        headerName: "Tag",
        flex: 1,
        minWidth: 140,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <Tooltip title={params.row.tag}>
            <span className="truncate" style={{ fontFamily: CODE_FONT_FAMILY }}>
              {params.row.tag}
            </span>
          </Tooltip>
        ),
      },
      {
        field: "registryIntegration",
        headerName: "Registry",
        width: 180,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => {
          const registry = params.row.registryIntegration;
          return registry ? (
            <Tooltip title={params.row.imageRepository}>
              <span className="min-w-0">
                <EntityReference
                  id={registry.id}
                  entityName="integration"
                  name={registry.name}
                  provider={registry.integrationProvider}
                />
              </span>
            </Tooltip>
          ) : null;
        },
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <StatusLabel status={params.row.status} />
        ),
      },
      {
        field: "imageDigest",
        headerName: "Digest",
        width: 170,
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
        width: 90,
        sortable: false,
        valueGetter: (_value: any, row: GqlServiceBuild) => formatDuration(row),
      },
      {
        field: "createdAt",
        headerName: "Started",
        width: 130,
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
        field: "actions",
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

  return (
    <>
      <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Images built from {commit.shortSha}</DialogTitle>
        <DialogContent>
          <DataTable
            rows={builds}
            getRowId={(row) => row.id}
            columns={columns}
            hideFooter
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      {logsBuild && (
        <LogsDialog
          entityId={logsBuild.id}
          action="build"
          view="logs"
          onClose={() => setLogsBuild(null)}
        />
      )}
    </>
  );
};
