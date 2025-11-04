import {
  getTextValue,
  CommonField,
  getProviderValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { UserResponse } from "../types";

export interface UserAboutProps {
  user: UserResponse;
}

export const UserOverview = ({ user }: UserAboutProps) => {
  return (
    <OverviewCard name={user.identifier} description={user.description}>
      <CommonField
        name={"Deactivated"}
        value={user.deactivated ? "Yes" : "No"}
      />
      <CommonField
        name={"Display Name"}
        value={getTextValue(user.display_name)}
      />
      <CommonField name={"Email"} value={getTextValue(user.email)} />
      <CommonField name={"First Name"} value={getTextValue(user.first_name)} />
      <CommonField name={"Last Name"} value={getTextValue(user.last_name)} />
      <CommonField name={"Identifier"} value={getTextValue(user.identifier)} />
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
