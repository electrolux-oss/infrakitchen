import { GraphqlFieldMap } from "../../common/graphql/buildGraphqlFields";

export const PERMISSION_CREATOR_FIELDS = `
  id
  identifier
  displayName
  provider
`;

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
  creator {
    ${PERMISSION_CREATOR_FIELDS}
  }
`;

export const PERMISSION_FIELD_MAP: GraphqlFieldMap = {
  creator: `creator { ${PERMISSION_CREATOR_FIELDS} }`,
  user_data: `userData { ${PERMISSION_CREATOR_FIELDS} }`,
  // entity_data: `entityData { id name _entity_name }`,
  userData: `userData { ${PERMISSION_CREATOR_FIELDS} }`,
  // entityData: `entityData { id name _entity_name }`,
};
