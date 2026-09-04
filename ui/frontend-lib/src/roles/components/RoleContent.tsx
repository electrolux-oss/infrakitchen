import { Alert, Box } from "@mui/material";

import { BaseCard } from "../../common/components/BaseCard";
import { OverviewCard } from "../../common/components/OverviewCard";
import { TabbedContent } from "../../common/components/TabbedContent";
import { ApiPoliciesCard } from "../../permissions/components/policies/ApiPoliciesCard";
import { EntityRolePoliciesCard } from "../../permissions/components/policies/EntityRolePoliciesCard";
import { RoleUsersCard } from "../../permissions/components/roles/RoleUsersCard";

export interface RoleContentProps {
  role: string | undefined;
}

export const RoleContent = (props: RoleContentProps) => {
  const { role } = props;
  if (!role) return <Alert severity="error">Role name is not provided</Alert>;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <OverviewCard name={role} />
      <TabbedContent
        defaultTab="Users"
        tabs={[
          {
            label: "Users",
            content: (
              <BaseCard>
                <RoleUsersCard role={role} />
              </BaseCard>
            ),
          },
          {
            label: "Resource Policies",
            content: (
              <BaseCard>
                <EntityRolePoliciesCard role={role} />
              </BaseCard>
            ),
          },
          {
            label: "API Policies",
            content: (
              <BaseCard>
                <ApiPoliciesCard role={role} />
              </BaseCard>
            ),
          },
        ]}
      />
    </Box>
  );
};
