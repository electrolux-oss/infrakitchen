import { PermissionResponse } from "../types";

/**
 * GraphQL response already uses camelCase (GqlPermission is same structure as PermissionResponse).
 * No transformation needed — both types use camelCase.
 */
export type GqlPermission = PermissionResponse;
