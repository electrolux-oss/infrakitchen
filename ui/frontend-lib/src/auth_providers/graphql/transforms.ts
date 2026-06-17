import { GqlUserShort, transformUserShort } from "../../users/graphql";
import {
  AuthProviderResponse,
  AuthProviderResponseOptional,
  AuthProviderShort,
} from "../types";

import type {
  AuthProviderGraphqlBaseField,
  AuthProviderGraphqlRelationField,
} from "./fragments";

type GqlAuthProviderBaseFieldTypes = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  authProvider: string;
  configuration: Record<string, any> | null;
  filterByDomain: string[] | null;
  createdAt: string;
  updatedAt: string;
};

type GqlAuthProviderRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlAuthProviderFieldTypes = GqlAuthProviderBaseFieldTypes &
  GqlAuthProviderRelationFieldTypes;

export type GqlAuthProvider = Pick<
  GqlAuthProviderFieldTypes,
  AuthProviderGraphqlBaseField | AuthProviderGraphqlRelationField
>;

export type GqlAuthProviderOptional = Partial<GqlAuthProvider> &
  Pick<GqlAuthProviderBaseFieldTypes, "id" | "name">;

export function transformAuthProviderShort(gql: {
  id: string;
  name: string;
}): AuthProviderShort {
  return {
    id: gql.id,
    name: gql.name,
  };
}

export function transformAuthProvider(
  gql: GqlAuthProvider,
): AuthProviderResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    enabled: gql.enabled,
    authProvider: gql.authProvider as AuthProviderResponse["authProvider"],
    configuration: gql.configuration ?? {},
    filterByDomain: gql.filterByDomain ?? [],
    creator: transformUserShort(gql.creator),
    createdAt: new Date(gql.createdAt),
    updatedAt: new Date(gql.updatedAt),
    _entity_name: "auth_provider",
  };
}

export function transformAuthProviderOptional(
  gql: GqlAuthProviderOptional,
): AuthProviderResponseOptional {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? undefined,
    enabled: gql.enabled,
    authProvider: gql.authProvider as
      | AuthProviderResponse["authProvider"]
      | undefined,
    configuration: gql.configuration ?? undefined,
    filterByDomain: gql.filterByDomain ?? undefined,
    creator:
      gql.creator !== undefined ? transformUserShort(gql.creator) : undefined,
    createdAt: gql.createdAt ? new Date(gql.createdAt) : undefined,
    updatedAt: gql.updatedAt ? new Date(gql.updatedAt) : undefined,
    _entity_name: "auth_provider",
  };
}
