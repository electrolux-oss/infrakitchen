import {
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { UserAvatar } from "../../common/components/UserAvatar";
import { UserResponse } from "../types";

interface UserAboutProps {
  user: UserResponse;
}

export const UserOverview = ({ user }: UserAboutProps) => {
  return (
    <OverviewCard
      name={user.identifier}
      description={user.description}
      icon={<UserAvatar identifier={user.identifier} />}
      chip={user.deactivated ? "Deactivated" : undefined}
      chipColor="error"
    >
      <CommonField name={"Display Name"} value={user.display_name} />
      <CommonField name={"Email"} value={user.email} />
      <CommonField name={"First Name"} value={user.first_name} />
      <CommonField name={"Last Name"} value={user.last_name} />
      <CommonField name={"Identifier"} value={user.identifier} />
      <CommonField name={"Is Primary"} value={user.is_primary ? "Yes" : "No"} />
      <CommonField name={"Provider"} value={getProviderValue(user.provider)} />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={user.created_at} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={user.updated_at} />}
      />
    </OverviewCard>
  );
};
