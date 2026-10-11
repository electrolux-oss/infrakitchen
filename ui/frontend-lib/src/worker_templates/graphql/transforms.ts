import { GqlUserShort } from "../../users/graphql";

import type {
  WorkerTemplateGraphqlBaseField,
  WorkerTemplateGraphqlRelationField,
} from "./fragments";

type GqlWorkerTemplateBaseFieldTypes = {
  id: string;
  name: string;
  description: string;
  provider: string;
  configuration: Record<string, any> | null;
  maxWorkers: number;
  idleTimeoutSeconds: number;
  priority: number;
  lastError: string | null;
  labels: string[] | null;
  state: string;
  status: string;
  revisionNumber: number;
  createdAt: string;
  updatedAt: string;
  entityName: string;
};

type GqlWorkerTemplateRelationFieldTypes = {
  creator: GqlUserShort | null;
};

type GqlWorkerTemplateFieldTypes = GqlWorkerTemplateBaseFieldTypes &
  GqlWorkerTemplateRelationFieldTypes;

export type GqlWorkerTemplate = Pick<
  GqlWorkerTemplateFieldTypes,
  WorkerTemplateGraphqlBaseField | WorkerTemplateGraphqlRelationField
>;

export interface GqlWorkerInstance {
  id: string;
  host: string;
  phase: string;
  createdAt: string | null;
  details: Record<string, any> | null;
}

export interface GqlWorkerInstances {
  instances: GqlWorkerInstance[];
  error: string | null;
}
