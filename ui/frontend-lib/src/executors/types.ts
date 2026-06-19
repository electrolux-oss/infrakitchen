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
