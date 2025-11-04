import {
  getTextValue,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { PermissionResponse } from "../types";

import { RoleCard } from "./RoleCard";

export interface PermissionAboutProps {
  permission: PermissionResponse;
}

export const getPermissionReference = (text: any) => {
  if (text === null || text === undefined || text === "") {
    return "N/A";
  }
  if (text.startsWith("resource:")) {
    return (
      <GetReferenceUrlValue
        _entity_name="resource"
        name="resource"
        id={text.slice(9)}
      />
    );
  }
  return text.toString();
};

export const PermissionOverview = ({ permission }: PermissionAboutProps) => {
  return (
    <OverviewCard
      name={permission.ptype === "p" ? "Policy" : "Role"}
      description={permission.description}
    >
      <CommonField name={"PType"} value={getTextValue(permission.ptype)} />
      <CommonField name={"V0"} value={getPermissionReference(permission.v0)} />
      <CommonField name={"V1"} value={getPermissionReference(permission.v1)} />
      <CommonField name={"V2"} value={getPermissionReference(permission.v2)} />
      <CommonField name={"V3"} value={getPermissionReference(permission.v3)} />
      <CommonField name={"V4"} value={getPermissionReference(permission.v4)} />
      <CommonField name={"V5"} value={getPermissionReference(permission.v5)} />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={permission.created_at}
            user={permission.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={permission.updated_at} />}
      />
      {permission.ptype == "g" && permission.v1 && (
        <RoleCard role_name={permission.v1} />
      )}
    </OverviewCard>
  );
};
