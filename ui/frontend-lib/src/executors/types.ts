import { IntegrationShort } from "../integrations/types";
import { SecretShort } from "../secrets/types";
import { SourceCodeShort } from "../source_codes/types";
import { StorageShort } from "../storages/types";
import { UserShort } from "../users";

export interface ExecutorShort {
  id: string;
  name: string;
  sourceCode: SourceCodeShort;
  _entity_name: string;
}

export interface ExecutorResponse {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  state: string;
  status: string;
  description: string;
  commandArgs: string;
  runtime: string;
  revisionNumber: number;
  creator: UserShort | null;
  integrationIds: IntegrationShort[];
  secretIds: SecretShort[];
  storage: StorageShort | null;
  sourceCode: SourceCodeShort | null;
  sourceCodeBranch: string | null;
  sourceCodeVersion: string | null;
  sourceCodeFolder: string;
  storagePath: string | null;
  labels: string[];
  isFavorite?: boolean;
  _entity_name: string;
}

export type ExecutorResponseOptional = Partial<ExecutorResponse>;

export interface ExecutorCreate {
  name: string;
  description: string;
  commandArgs: string;
  runtime: string;
  storageId: string | null;
  sourceCodeId: string;
  sourceCodeBranch?: string;
  sourceCodeVersion?: string;
  sourceCodeFolder: string;
  integrationIds: string[];
  secretIds: string[];
  storagePath: string | null;
  labels: string[];
}

export interface ExecutorUpdate {
  description: string;
  commandArgs: string;
  sourceCodeBranch?: string;
  sourceCodeVersion?: string;
  sourceCodeFolder: string;
  sourceCodeId: string;
  integrationIds: string[];
  secretIds: string[];
  labels: string[];
  storagePath: string | null;
  storageId: string | null;
}
