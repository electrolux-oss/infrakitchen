import { GqlUserShort } from "../../users/graphql";

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
  entityName: string;
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
