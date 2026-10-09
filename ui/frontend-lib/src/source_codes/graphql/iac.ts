import { buildSelection } from "../../common/graphql/buildGraphqlFields";
import {
  GqlIntegrationShort,
  INTEGRATION_SHORT_FIELDS,
} from "../../integrations/graphql";
import { GqlStorageShort, STORAGE_SHORT_FIELDS } from "../../storages/graphql";
import { ToolShort } from "../../tools";
import { GqlUserShort, USER_SHORT_FIELDS } from "../../users/graphql";

import type {
  GqlIacEnvironment,
  GqlIacModule,
  GqlIacRegion,
  GqlIacVariable,
} from "./transforms";

// Environment name of a module that is run without environments.
export const DEFAULT_ENVIRONMENT_NAME = "default";
export const DEFAULT_STATE_PATH_TEMPLATE = "{module}/{env}.tfstate";

export type GqlIacEnvironmentConfig = {
  id: string;
  name: string;
  integrations: GqlIntegrationShort[];
  storage: GqlStorageShort | null;
  statePathTemplate: string;
  toolId: string | null;
  tool: ToolShort | null;
  // Regions to run in when the repository does not show them
  regions: string[] | null;
  // Variable that gets the region of a run (TF_VAR_<name>)
  regionVariable: string | null;
  // Passed to every module run as TF_VAR_<name>
  variables: Record<string, string> | null;
  // Region -> the variables that differ there
  regionVariables: Record<string, Record<string, string>> | null;
};

export type GqlIacRun = {
  id: string;
  modulePath: string;
  environmentName: string;
  region: string | null;
  action: string;
  // Branch or tag the run was started from, null when a commit was picked
  ref: string | null;
  // Resolved by the worker when the run was started from a branch or tag
  sha: string | null;
  status: string;
  toAdd: number | null;
  toChange: number | null;
  toDestroy: number | null;
  creator: GqlUserShort | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

// Regions an environment is run in: the discovered ones, else those declared in its settings.
export const environmentRegions = (
  environment: GqlIacEnvironment,
  config: GqlIacEnvironmentConfig | undefined,
): GqlIacRegion[] =>
  environment.regions.length
    ? environment.regions
    : (config?.regions ?? []).map((name) => ({
        name,
        workingDir: environment.workingDir,
        varFiles: environment.varFiles,
      }));

export const isActiveRun = (run: Pick<GqlIacRun, "status">) =>
  ["queued", "in_progress"].includes(run.status.toLowerCase());

const IAC_ENVIRONMENT_CONFIG_FIELDS = `
  id
  name
  integrations { ${INTEGRATION_SHORT_FIELDS} }
  storage { ${STORAGE_SHORT_FIELDS} }
  statePathTemplate
  toolId
  regions
  regionVariable
  variables
  regionVariables
  tool { ${buildSelection(["id", "name", "version", "os", "arch"])} }
`;

const IAC_RUN_FIELDS = `
  id
  modulePath
  environmentName
  region
  action
  ref
  sha
  status
  toAdd
  toChange
  toDestroy
  creator { ${USER_SHORT_FIELDS} }
  createdAt
  startedAt
  finishedAt
`;

export const IAC_ENVIRONMENT_CONFIGS_QUERY = `
  query IacEnvironmentConfigs($sourceCodeId: UUID!) {
    iacEnvironmentConfigs(sourceCodeId: $sourceCodeId) {
      ${IAC_ENVIRONMENT_CONFIG_FIELDS}
    }
  }
`;

export const IAC_LATEST_RUNS_QUERY = `
  query IacLatestRuns($sourceCodeId: UUID!) {
    iacLatestRuns(sourceCodeId: $sourceCodeId) {
      ${IAC_RUN_FIELDS}
    }
  }
`;

export const IAC_RUNS_QUERY = `
  query IacRuns(
    $sourceCodeId: UUID!
    $modulePath: String
    $environmentName: String
    $region: String
    $range: [Int!]
  ) {
    iacRuns(
      sourceCodeId: $sourceCodeId
      modulePath: $modulePath
      environmentName: $environmentName
      region: $region
      range: $range
    ) {
      ${IAC_RUN_FIELDS}
    }
    iacRunsCount(
      sourceCodeId: $sourceCodeId
      modulePath: $modulePath
      environmentName: $environmentName
      region: $region
    )
  }
`;

export const CREATE_IAC_ENVIRONMENT_CONFIG_MUTATION = `
  mutation CreateIacEnvironmentConfig(
    $sourceCodeId: UUID!
    $input: IacEnvironmentConfigCreateInput!
  ) {
    createIacEnvironmentConfig(sourceCodeId: $sourceCodeId, input: $input) {
      id
    }
  }
`;

export const UPDATE_IAC_ENVIRONMENT_CONFIG_MUTATION = `
  mutation UpdateIacEnvironmentConfig(
    $id: UUID!
    $input: IacEnvironmentConfigUpdateInput!
  ) {
    updateIacEnvironmentConfig(id: $id, input: $input) {
      id
    }
  }
`;

export const DELETE_IAC_ENVIRONMENT_CONFIG_MUTATION = `
  mutation DeleteIacEnvironmentConfig($id: UUID!) {
    deleteIacEnvironmentConfig(id: $id)
  }
`;

export const PLAN_IAC_MODULE_MUTATION = `
  mutation PlanIacModule($sourceCodeId: UUID!, $input: IacPlanInput!) {
    planIacModule(sourceCodeId: $sourceCodeId, input: $input) {
      ${IAC_RUN_FIELDS}
    }
  }
`;

// Variables declared by the modules of an environment, and the regions found for it.
export const environmentDiscovery = (
  modules: GqlIacModule[],
  environmentName: string,
): { variables: GqlIacVariable[]; regions: string[] } => {
  const variables = new Map<string, GqlIacVariable>();
  const regions = new Set<string>();
  for (const module of modules) {
    const environments = module.environments.length
      ? module.environments.filter((env) => env.name === environmentName)
      : environmentName === DEFAULT_ENVIRONMENT_NAME
        ? [null]
        : [];
    if (environments.length === 0) continue;
    for (const env of environments) {
      env?.regions.forEach((region) => regions.add(region.name));
    }
    for (const variable of module.variables ?? []) {
      const known = variables.get(variable.name);
      // Required as soon as one module has no default for it.
      variables.set(
        variable.name,
        known
          ? { ...known, required: known.required || variable.required }
          : variable,
      );
    }
  }
  return {
    variables: [...variables.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    regions: [...regions].sort(),
  };
};
