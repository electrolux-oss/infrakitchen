import { BaseCard } from "../../common/components/cards/BaseCard";
import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { TabbedContent } from "../../common/components/cards/TabbedContent";
import { ApiPoliciesCard } from "../../permissions/components/policies/ApiPoliciesCard";
import { EntityRolePoliciesCard } from "../../permissions/components/policies/EntityRolePoliciesCard";
import { RoleUsersCard } from "../../permissions/components/roles/RoleUsersCard";
import { Alert } from "../../ui";

export interface RoleContentProps {
  role: string | undefined;
}

export const RoleContent = (props: RoleContentProps) => {
  const { role } = props;
  if (!role) return <Alert severity="error">Role name is not provided</Alert>;

  return (
    <div className="flex w-full max-w-full flex-col gap-4">
      <OverviewCard name={role} />
      <TabbedContent
        defaultTab="Users"
        tabs={[
          {
            label: "Users",
            content: (
              <BaseCard>
                <div className="col-span-full">
                  <RoleUsersCard role={role} />
                </div>
              </BaseCard>
            ),
          },
          {
            label: "Resource Policies",
            content: (
              <BaseCard>
                <div className="col-span-full">
                  <EntityRolePoliciesCard role={role} />
                </div>
              </BaseCard>
            ),
          },
          {
            label: "API Policies",
            content: (
              <BaseCard>
                <div className="col-span-full">
                  <ApiPoliciesCard role={role} />
                </div>
              </BaseCard>
            ),
          },
        ]}
      />
    </div>
  );
};
