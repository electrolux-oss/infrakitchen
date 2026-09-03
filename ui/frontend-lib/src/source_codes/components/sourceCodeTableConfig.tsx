import { GridRenderCellParams } from "@mui/x-data-grid";

import { getRepoNameFromUrl } from "../../common";
import { Chip as MuiChip, Stack } from "@mui/material";
import { GetEntityLink } from "../../common/components/CommonField";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import {
  labelsColumn,
  relativeTimeColumn,
} from "../../common/components/entity_table/tableColumns";
import { serverSearchReference } from "../../common/components/filter_panel/referenceLoaders";
import StatusChip from "../../common/StatusChip";
import { solidChipColorSx } from "../../common/utils/softChip";
import { ENTITY_STATUS } from "../../utils/constants";

/** True if the row was updated within the last 7 days (matches card badge). */
const isRecentlyUpdated = (updatedAt?: string | Date | null) => {
  if (!updatedAt) return false;
  const days =
    (new Date().getTime() - new Date(updatedAt).getTime()) /
    (1000 * 60 * 60 * 24);
  return days <= 7;
};

export const sourceCodeColumns: EntityTableColumn[] = [
  {
    field: "sourceCodeUrl",
    headerName: "Name",
    flex: 1,
    fetchFields: ["sourceCodeUrl", "entityName"],
    filter: {
      field: "source_code_url",
      operators: ["like", "not_like", "eq"],
      valueType: "text",
      defaultOperator: "like",
      defaultSelected: true,
    },
    valueGetter: (_value: any, row: any) =>
      getRepoNameFromUrl(row.sourceCodeUrl || ""),
    renderCell: (params: GridRenderCellParams) => {
      const sourceCode = params.row;
      const repoName = getRepoNameFromUrl(sourceCode.sourceCodeUrl || "");
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <GetEntityLink {...sourceCode} name={repoName} />
          {isRecentlyUpdated(sourceCode.updatedAt) && (
            <MuiChip
              label="Updated"
              size="small"
              variant="filled"
              sx={solidChipColorSx("success", undefined, undefined, true)}
            />
          )}
        </Stack>
      );
    },
  },
  {
    field: "description",
    headerName: "Description",
  },
  labelsColumn("source_code"),
  {
    field: "status",
    headerName: "Status",
    flex: 1,
    filter: {
      field: "status",
      operators: ["eq", "in"],
      valueType: "select",
      defaultOperator: "eq",
      selectOptions: [
        { label: "Queued", value: ENTITY_STATUS.QUEUED },
        { label: "In Progress", value: ENTITY_STATUS.IN_PROGRESS },
        { label: "Done", value: ENTITY_STATUS.DONE },
        { label: "Error", value: ENTITY_STATUS.ERROR },
        { label: "Unknown", value: ENTITY_STATUS.UNKNOWN },
        { label: "Pending", value: ENTITY_STATUS.PENDING },
        { label: "Ready", value: ENTITY_STATUS.READY },
      ],
    },
    renderCell: (params: GridRenderCellParams) => (
      <StatusChip status={params.row.status} />
    ),
  },
  relativeTimeColumn("updatedAt", "Last Updated", {
    sortField: "updated_at",
  }),
  {
    field: "creator",
    headerName: "Creator",
    flex: 1,
    sortField: "creator.identifier",
    filter: {
      field: "created_by",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
    valueGetter: (_value: any, row: any) => row.creator?.identifier || "",
    renderCell: (params: GridRenderCellParams) => {
      const creator = params.row.creator;
      if (!creator) return null;
      return <GetEntityLink {...creator} name={creator.identifier} />;
    },
  },
];
