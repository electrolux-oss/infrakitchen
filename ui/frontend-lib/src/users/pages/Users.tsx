import { useMemo } from "react";

import { useNavigate } from "react-router";

import { Button, Box } from "@mui/material";
import { GridRenderCellParams } from "@mui/x-data-grid";

import { useConfig } from "../../common";
import {
  getDateValue,
  GetEntityLink,
  getProviderValue,
} from "../../common/components/CommonField";
import { EntityFetchTable } from "../../common/components/EntityFetchTable";
import PageContainer from "../../common/PageContainer";

export const UsersPage = () => {
  const { linkPrefix } = useConfig();

  const navigate = useNavigate();

  const columns = useMemo(
    () => [
      {
        field: "identifier",
        headerName: "Identifier",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => {
          return <GetEntityLink {...params.row} />;
        },
      },
      {
        field: "display_name",
        headerName: "Display Name",
        flex: 1,
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1,
      },
      {
        field: "provider",
        headerName: "Provider",
        flex: 1,
        renderCell: (params: GridRenderCellParams) => (
          <Box display="flex" alignItems="center" height="100%">
            {getProviderValue(params.value)}
          </Box>
        ),
      },
      {
        field: "created_at",
        headerName: "Created At",
        flex: 1,
        renderCell: (params: GridRenderCellParams) =>
          getDateValue(params.value),
      },
    ],
    [],
  );

  return (
    <PageContainer
      title="Users"
      actions={
        <Button
          variant="outlined"
          color="primary"
          onClick={() => navigate(`${linkPrefix}users/create`)}
        >
          Create
        </Button>
      }
    >
      <EntityFetchTable
        title="Users"
        entityName="user"
        columns={columns}
        searchName="identifier"
        fields={[
          "id",
          "identifier",
          "display_name",
          "email",
          "provider",
          "created_at",
        ]}
      />
    </PageContainer>
  );
};

UsersPage.path = "/users";
