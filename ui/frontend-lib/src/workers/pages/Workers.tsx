import { useMemo } from "react";

import { Box, Tooltip, Typography } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { GetEntityLink } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import { RelativeTime } from "../../common/components/RelativeTime";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";
import { WORKER_FIELD_MAP } from "../graphql";

// Helper function to flatten nested objects,
// same as the one in the original code.
const flattenObject = (object: any) => {
  const result: Record<string, object> = {};
  for (const i in object) {
    if (typeof object[i] === "object" && object[i] !== null) {
      const flatObj = flattenObject(object[i]);
      for (const x in flatObj) {
        if (x) {
          result[`${i}_${x}`] = flatObj[x];
        }
      }
    } else {
      result[i] = object[i];
    }
  }
  return result;
};

const HostInfoField = {
  field: "hostMetadata",
  sortable: false,
  headerName: "Host info",
  flex: 2,
  renderCell: (params: GridRenderCellParams) => {
    if (!params.value) {
      return null;
    }

    const metadata = flattenObject(params.value);

    const formattedString = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");

    const platform = metadata.platform || "N/A";
    const arch = metadata.machine || "N/A";

    const condensedDisplay = `${platform} (${arch})`;

    return (
      <Tooltip
        title={
          <Typography component="pre" variant="caption">
            {formattedString}
          </Typography>
        }
        placement="top-start"
      >
        <Box
          sx={{
            width: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <Typography variant="body2" color="textSecondary">
            {condensedDisplay}
          </Typography>
        </Box>
      </Tooltip>
    );
  },
};

export default function WorkerList() {
  const columns = useMemo(
    () => [
      {
        field: "host",
        headerName: "Host",
        flex: 1,
        hideable: false,
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={String(params.row.status).toLowerCase()} />
        ),
      },
      {
        field: "currentTask",
        headerName: "Last Task",
        flex: 2,
        sortable: false,
        renderCell: (params: GridRenderCellParams) => {
          if (!params.value) {
            return (
              <Typography variant="body2" color="textSecondary">
                N/A
              </Typography>
            );
          }
          // current_task is a free-form JSON blob stored with snake_case keys.
          const { entity, entity_id, action, user, started_at } = params.value;
          const label = `${entity} / ${action}`;
          return (
            <Tooltip
              title={
                <Typography component="pre" variant="caption">
                  {`Entity: ${entity}\nID: ${entity_id}\nAction: ${action}\nUser: ${user}\nStarted: ${started_at}`}
                </Typography>
              }
              placement="top-start"
            >
              <Typography variant="body1">
                <GetEntityLink
                  entityName={entity}
                  id={entity_id}
                  identifier={label}
                />
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "tasksCompleted",
        headerName: "Completed",
        flex: 0.5,
        sortField: "tasks_completed",
        renderCell: (params: GridRenderCellParams) => (
          <Typography variant="body2">{params.value ?? 0}</Typography>
        ),
      },
      {
        field: "createdAt",
        headerName: "Created",
        flex: 1,
        sortField: "created_at",
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{
              fontSize: "0.75rem",
              display: "flex",
            }}
          />
        ),
      },
      {
        field: "updatedAt",
        headerName: "Last Updated",
        flex: 1,
        sortField: "updated_at",
        renderCell: (params: GridRenderCellParams) => (
          <RelativeTime
            date={params.value}
            sx={{
              fontSize: "0.75rem",
              display: "flex",
            }}
          />
        ),
      },
      HostInfoField,
    ],
    [],
  );

  return (
    <PageContainer title="Workers">
      <EntityFetchTable
        title="Workers"
        entityName="worker"
        columns={columns}
        entityFieldMap={WORKER_FIELD_MAP}
      />
    </PageContainer>
  );
}
