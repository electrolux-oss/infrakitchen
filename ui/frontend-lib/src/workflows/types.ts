import { WiringRule } from "../common/components/viewers/Wiring/types";
import { IntegrationShort } from "../integrations/types";
import { ResourceShort } from "../resources/types";
import { SecretShort } from "../secrets/types";
import { SourceCodeVersionShort } from "../source_code_versions/types";
import { TemplateShort } from "../templates/types";
import { UserShort } from "../users";
import { ENTITY_STATUS } from "../utils";

export interface WorkflowStepResponse {
  id: string;
  templateId: string;
  template: TemplateShort | null;
  resourceId: string | null;
  resource: ResourceShort | null;
  position: number;
  status: ENTITY_STATUS;
  errorMessage: string | null;
  resolvedVariables: Record<string, any>;
  parentResourceIds: ResourceShort[] & {
    template?: TemplateShort;
  };
  integrationIds: IntegrationShort[];
  secretIds: SecretShort[];
  sourceCodeVersionId: string | null;
  sourceCodeVersion: SourceCodeVersionShort | null;
  storageId: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface WorkflowResponse {
  id: string;
  action: "create" | "destroy";
  status: ENTITY_STATUS;
  errorMessage: string | null;
  steps: WorkflowStepResponse[];
  wiringSnapshot: WiringRule[];
  creator: UserShort;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  _entity_name: string;
}

export type WorkflowResponseOptional = Partial<WorkflowResponse>;
