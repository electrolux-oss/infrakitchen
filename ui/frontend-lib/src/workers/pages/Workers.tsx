import { useState, useEffect } from "react";

import { Box, Tooltip, Typography } from "@mui/material";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

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
  field: "host_metadata",
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
  const [counter, setCounter] = useState(1);

  useEffect(() => {
    let timerId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      setCounter((prev) => prev + 1);
      timerId = setTimeout(poll, 10000);
    };

    poll();

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [setCounter]);

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
    },
    {
      field: "status",
      headerName: "Status",
      flex: 1,
      renderCell: (params: GridRenderCellParams) => (
        <StatusChip status={String(params.row.status).toLowerCase()} />
      ),
    },

    { field: "host", headerName: "Host", flex: 1 },
    { field: "created_at", headerName: "Created At", flex: 1 },
    { field: "updated_at", headerName: "Updated At", flex: 1 },
    HostInfoField,
  ];

  return (
    <PageContainer title="Workers">
      <EntityFetchTable
        key={counter}
        title="Workers"
        entityName="worker"
        columns={columns}
      />
    </PageContainer>
  );
}
