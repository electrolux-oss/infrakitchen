import { GraphqlFieldMap } from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const PERMISSION_FIELDS = `
  id
  ptype
  v0
  v1
  v2
  v3
  v4
  v5
  createdAt
  updatedAt
  entityName
  creator {
    ${USER_SHORT_FIELDS}
  }
`;

export const PERMISSION_FIELD_MAP: GraphqlFieldMap = {
  creator: `creator { ${USER_SHORT_FIELDS} }`,
  userData: `userData { ${USER_SHORT_FIELDS} }`,
};
