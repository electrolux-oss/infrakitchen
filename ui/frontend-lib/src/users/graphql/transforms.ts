import type {
  UserGraphqlBaseField,
  UserGraphqlRelationField,
  UserGraphqlShortField,
} from "./fragments";

type GqlUserShortFieldTypes = {
  id: string;
  identifier: string;
  provider: string;
  entityName: string;
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
  entityName: string;
};

type GqlUserMetadata = {
  slackId: string | null;
};

type GqlUserRelationFieldTypes = {
  meta: GqlUserMetadata | null;
  secondaryAccounts: GqlUserShort[] | null;
  primaryAccount: GqlUserShort[] | null;
};

type GqlUserFieldTypes = GqlUserBaseFieldTypes & GqlUserRelationFieldTypes;

export type GqlUser = Pick<
  GqlUserFieldTypes,
  UserGraphqlBaseField | UserGraphqlRelationField | "meta"
>;

export type GqlUserOptional = Partial<GqlUser> &
  Pick<GqlUserShortFieldTypes, "id" | "identifier" | "provider" | "entityName">;
