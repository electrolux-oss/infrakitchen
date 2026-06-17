// Removed user transform imports - no longer needed for identity transform
import { PermissionResponse } from "../types";

/**
 * GraphQL response already uses camelCase (GqlPermission is same structure as PermissionResponse).
 * No transformation needed — both types use camelCase.
 */
export type GqlPermission = PermissionResponse;

export function transformPermission(
  gql: PermissionResponse,
): PermissionResponse {
  // Identity transform — GraphQL response already matches PermissionResponse
  return gql;
}

export function transformPermissions(gqlList: PermissionResponse[]) {
  return gqlList;
}
