import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlSecretShort } from "../../secrets/graphql";
import { GqlSourceCodeShort } from "../../source_codes/graphql";
import { GqlStorageShort } from "../../storages/graphql";
import { GqlUserShort } from "../../users/graphql";

export interface GqlExecutor {
  id: string;
  name: string;
  entityName: string;
  description: string;
  runtime: string;
  commandArgs: string;
  sourceCode: GqlSourceCodeShort | null;
  sourceCodeVersion: string | null;
  sourceCodeBranch: string | null;
  sourceCodeFolder: string | null;
  integrationIds: GqlIntegrationShort[] | null;
  secretIds: GqlSecretShort[] | null;
  storage: GqlStorageShort | null;
  storagePath: string | null;
  labels: string[] | null;
  state: string;
  status: string;
  revisionNumber: number;
  creator: GqlUserShort | null;
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
}

export type GqlExecutorOptional = Partial<GqlExecutor> & {
  id: string;
  name: string;
  entityName: string;
};
