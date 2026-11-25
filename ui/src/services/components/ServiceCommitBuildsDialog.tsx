import { useMemo, useState } from "react";

import { UserAvatar } from "../../common/components/entities/UserAvatar";
import { EntityReference } from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { StatusLabel } from "../../common/components/labels";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { LogsDialog } from "../../common/LogsComponent/LogsDialog";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { copyToClipboard } from "../../common/utils/clipboard";
import { HeroDocumentDuplicateIcon } from "../../icons";
import { GqlSourceCodeCommit } from "../../source_codes/graphql";
import {
  Button,
  DataTable,
  DataTableColumn,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  RenderCellParams,
  Tooltip,
} from "../../ui";
import { GqlServiceBuild } from "../graphql";

import { formatDuration } from "./builds";

const EmptyCell = () => <span className="text-fg-muted">—</span>;

const CopyButton = ({ text }: { text: string }) => (
  <IconButton
    size="small"
    aria-label={`Copy ${text}`}
    onClick={() =>
      copyToClipboard(text).then(
        () => notify("Copied to clipboard", "info"),
        notifyError,
      )
    }
  >
    <HeroDocumentDuplicateIcon fontSize="small" />
  </IconButton>
);

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
        flex: 0.7,
        minWidth: 120,
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
        field: "images",
        headerName: "Images",
        flex: 2,
        minWidth: 260,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <div className="flex min-w-0 flex-col gap-1 py-1">
            {params.row.images.map((image) => {
              const reference =
                image.image ?? `${image.imageRepository}:${params.row.tag}`;
              return (
                <div
                  key={`${image.registryIntegrationId}/${image.imageRepository}`}
                  className="flex min-w-0 flex-col"
                >
                  <span className="min-w-0">
                    <EntityReference
                      id={image.registryIntegrationId}
                      entityName="integration"
                      name={image.registryName}
                      provider={image.registryProvider}
                    />
                  </span>
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <Tooltip title={reference}>
                      <span
                        className="truncate text-body2 text-fg-muted"
                        style={{ fontFamily: CODE_FONT_FAMILY }}
                      >
                        {reference}
                      </span>
                    </Tooltip>
                    {image.image && <CopyButton text={image.image} />}
                  </span>
                </div>
              );
            })}
          </div>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 130,
        sortable: false,
        mobile: "badge",
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => (
          <StatusLabel status={params.row.status} />
        ),
      },
      {
        field: "imageDigest",
        headerName: "Digest",
        width: 200,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) => {
          const { imageDigest } = params.row;
          if (!imageDigest) return <EmptyCell />;
          return (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Tooltip title={imageDigest}>
                <span
                  className="truncate"
                  style={{ fontFamily: CODE_FONT_FAMILY }}
                >
                  {imageDigest.slice(0, 19)}
                </span>
              </Tooltip>
              <CopyButton text={imageDigest} />
            </span>
          );
        },
      },
      {
        field: "duration",
        headerName: "Duration",
        width: 90,
        sortable: false,
        renderCell: (params: RenderCellParams<GqlServiceBuild>) =>
          formatDuration(params.row) || <EmptyCell />,
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
        width: 90,
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
            mobileCards
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
