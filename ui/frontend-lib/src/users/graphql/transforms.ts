import { mapNullableArray } from "../../common/graphql/transformUtils";
import { UserResponse, UserResponseOptional, UserShort } from "../types";

import type {
  UserGraphqlBaseField,
  UserGraphqlRelationField,
  UserGraphqlShortField,
} from "./fragments";

type GqlUserShortFieldTypes = {
  id: string;
  identifier: string;
  provider: string;
};

export type GqlUserShort = Pick<GqlUserShortFieldTypes, UserGraphqlShortField>;

type GqlUserBaseFieldTypes = {
  id: string;
  identifier: string;
  displayName: string | null;
  email: string | null;
  provider: string;
  createdAt: string;
  updatedAt: string;
  description: string | null;
  firstName: string | null;
  lastName: string | null;
  deactivated: boolean;
  isPrimary: boolean | null;
};

type GqlUserMetadata = {
  slackId: string | null;
};

type GqlUserRelationFieldTypes = {
  meta: GqlUserMetadata | null;
  secondaryAccounts: (GqlUserShort | null)[] | null;
  primaryAccount: (GqlUserShort | null)[] | null;
};

type GqlUserFieldTypes = GqlUserBaseFieldTypes & GqlUserRelationFieldTypes;

export type GqlUser = Pick<
  GqlUserFieldTypes,
  UserGraphqlBaseField | UserGraphqlRelationField | "meta"
>;

export type GqlUserOptional = Partial<GqlUser> &
  Pick<GqlUserShortFieldTypes, "id" | "identifier" | "provider">;

export function transformUserShort(
  user: GqlUserShort | null,
): UserShort | null {
  if (!user) {
    return null;
  }
  return {
    id: user.id,
    identifier: user.identifier,
    provider: user.provider,
    _entity_name: "user",
  };
}

export function transformUser(gql: GqlUser): UserResponse {
  const secondaryAccounts = mapNullableArray(
    gql.secondaryAccounts,
    transformUserShort,
  );
  const primaryAccount = mapNullableArray(
    gql.primaryAccount,
    transformUserShort,
  );

  return {
    id: gql.id,
    identifier: gql.identifier,
    displayName: gql.displayName ?? "",
    email: gql.email ?? "",
    provider: gql.provider,
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    description: gql.description ?? "",
    firstName: gql.firstName ?? "",
    lastName: gql.lastName ?? "",
    deactivated: gql.deactivated,
    isPrimary: gql.isPrimary ?? false,
    meta: gql.meta ? { slackId: gql.meta.slackId } : null,
    secondaryAccounts: secondaryAccounts,
    primaryAccount: primaryAccount,
    _entity_name: "user",
  };
}

export function transformUserOptional(
  gql: GqlUserOptional,
): UserResponseOptional {
  const secondaryAccounts = mapNullableArray(
    gql.secondaryAccounts ?? null,
    transformUserShort,
  );
  const primaryAccount = mapNullableArray(
    gql.primaryAccount ?? null,
    transformUserShort,
  );

  return {
    id: gql.id,
    identifier: gql.identifier,
    displayName: gql.displayName ?? undefined,
    email: gql.email ?? undefined,
    provider: gql.provider,
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    description: gql.description ?? undefined,
    firstName: gql.firstName ?? undefined,
    lastName: gql.lastName ?? undefined,
    deactivated: gql.deactivated,
    isPrimary: gql.isPrimary ?? undefined,
    meta: gql.meta ? { slackId: gql.meta.slackId } : null,
    secondaryAccounts: secondaryAccounts,
    primaryAccount: primaryAccount,
    _entity_name: "user",
  };
}
