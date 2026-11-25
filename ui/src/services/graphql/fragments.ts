import {
  GraphqlFieldMap,
  buildSelection,
  buildNestedSelection,
} from "../../common/graphql/buildGraphqlFields";
import { USER_SHORT_FIELDS } from "../../users/graphql";

export const SERVICE_GRAPHQL_FIELDS = {
  short: ["id", "name", "entityName"] as const,
  list: [
    "id",
    "name",
    "description",
    "labels",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  detail: [
    "id",
    "name",
    "description",
    "projectId",
    "sourceCodeId",
    "dockerfilePath",
    "buildContext",
    "labels",
    "revisionNumber",
    "createdAt",
    "updatedAt",
    "entityName",
  ] as const,
  relations: {
    creator: "creator",
    owners: "owners",
    project: "project",
    sourceCode: "sourceCode",
    registries: "registries",
    baseImageRegistries: "baseImageRegistries",
  } as const,
};

export type ServiceGraphqlShortField =
  | (typeof SERVICE_GRAPHQL_FIELDS.short)[number]
  | typeof SERVICE_GRAPHQL_FIELDS.relations.owners;
export type ServiceGraphqlDetailField =
  (typeof SERVICE_GRAPHQL_FIELDS.detail)[number];
export type ServiceGraphqlRelationKey =
  keyof typeof SERVICE_GRAPHQL_FIELDS.relations;
export type ServiceGraphqlRelationField =
  (typeof SERVICE_GRAPHQL_FIELDS.relations)[ServiceGraphqlRelationKey];

export const SERVICE_LIST_FIELDS = `
  ${buildSelection(SERVICE_GRAPHQL_FIELDS.list)}
`;

const PROJECT_SHORT_FIELDS = `
  id
  name
`;

/** Maps snake_case table column fields to their GraphQL selection strings. */
export const SERVICE_FIELD_MAP: GraphqlFieldMap = {
  project: buildNestedSelection(
    SERVICE_GRAPHQL_FIELDS.relations.project,
    `
      id
      name
      entityName
    `,
  ),
};

const REGISTRY_INTEGRATION_FIELDS = `
  id
  name
  integrationProvider
  entityName
`;

const SERVICE_REGISTRY_FIELDS = `
  id
  imageRepository
  ${buildNestedSelection("registryIntegration", REGISTRY_INTEGRATION_FIELDS)}
`;

const SERVICE_BUILD_IMAGE_FIELDS = `
  registryIntegrationId
  registryName
  registryProvider
  imageRepository
  image
`;

const SOURCE_CODE_FIELDS = `
  id
  identifier
  sourceCodeUrl
  sourceCodeProvider
  defaultBranch
  commitCount
  gitTags
  gitTagShas
  status
  updatedAt
  entityName
  integration {
    id
  }
`;

export const SERVICE_DETAIL_FIELDS = `
  ${buildSelection(SERVICE_GRAPHQL_FIELDS.detail)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.creator, USER_SHORT_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.owners, USER_SHORT_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.project, PROJECT_SHORT_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.sourceCode, SOURCE_CODE_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.registries, SERVICE_REGISTRY_FIELDS)}
  ${buildNestedSelection(SERVICE_GRAPHQL_FIELDS.relations.baseImageRegistries, REGISTRY_INTEGRATION_FIELDS)}
`;

export const SERVICE_BUILD_FIELDS = `
  id
  serviceId
  commitSha
  tag
  imageDigest
  status
  startedAt
  finishedAt
  createdAt
  entityName
  ${buildNestedSelection("creator", USER_SHORT_FIELDS)}
  ${buildNestedSelection("images", SERVICE_BUILD_IMAGE_FIELDS)}
`;
