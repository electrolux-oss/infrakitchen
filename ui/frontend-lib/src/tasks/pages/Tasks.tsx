import { useState, useEffect, useMemo } from "react";

import { useNavigate } from "react-router";

import { Link } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import { getDateValue } from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";
import StatusChip from "../../common/StatusChip";

export const TasksPage = () => {
  const { linkPrefix, ikApi } = useConfig();

  const [entities, setEntities] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    ikApi.getList("entities", {}).then((response) => {
      setEntities(response.data);
    });
  }, [ikApi]);

  const columns = useMemo(
    () => [
      {
        field: "entity",
        headerName: "Entity",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          return (
            <Link
              onClick={() => {
                navigate(
                  `${linkPrefix}${params.row.entity}s/${params.row.entity_id}`,
                );
              }}
              rel="noopener"
              style={{ cursor: "pointer" }}
            >
              {params.row.entity}
            </Link>
          );
        },
      },
      {
        field: "status",
        headerName: "Status",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <StatusChip status={params.row.status} state={params.row.state} />
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
      {
        field: "updated_at",
        headerName: "Updated At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [navigate, linkPrefix],
  );

  return (
    <PageContainer title="Tasks">
      <EntityFetchTable
        title="Tasks"
        entityName="task"
        columns={columns}
        filters={entities}
        filterName="entity"
      />
    </PageContainer>
  );
};

TasksPage.path = "/tasks";
