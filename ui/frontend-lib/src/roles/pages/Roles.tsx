import { useState, useEffect, useCallback } from "react";

import { Box } from "@mui/material";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
import PageContainer from "../../common/PageContainer";
import { RoleTable } from "../components/RolesTable";

export const RolesPage = () => {
  const { ikApi } = useConfig();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string[]>([]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const response = await ikApi.getList("permissions/roles", {
        pagination: { page: 1, perPage: 1000 },
        sort: { field: "name", order: "ASC" },
      });
      setData(response.data);
    } catch (error: any) {
      notifyError(error);
      // errorApi.post(error);
    } finally {
      setLoading(false);
    }
  }, [ikApi, setData, setLoading]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return (
    <PageContainer title="Roles">
      <Box sx={{ maxWidth: 1400, width: "100%", alignSelf: "center" }}>
        <RoleTable roles={data} loading={loading} />
      </Box>
    </PageContainer>
  );
};

RolesPage.path = "/roles";
