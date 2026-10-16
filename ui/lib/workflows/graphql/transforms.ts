import { GqlIntegrationShort } from "../../integrations/graphql";
import { GqlResourceShort } from "../../resources/graphql";
import { GqlSecret } from "../../secrets/graphql";
import { GqlSourceCodeVersionShort } from "../../source_code_versions/graphql";
import { GqlTemplateShort } from "../../templates/graphql";
import { GqlUserShort } from "../../users/graphql";

export interface GqlWorkflowStep {
  id: string;
  template: GqlTemplateShort;
  resource: GqlResourceShort;
  position: number;
  status: string;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  sourceCodeVersion?: GqlSourceCodeVersionShort | null;
  parentResourceIds?: GqlResourceShort[];
  integrationIds?: GqlIntegrationShort[];
  secretIds?: GqlSecret[] | null;
  storageId?: string | null;
  resolvedVariables?: Record<string, any> | null;
}

export interface GqlWorkflow {
  id: string;
  action: "create" | "destroy";
  entityName: string;
  status: string;
  errorMessage: string | null;
  steps: GqlWorkflowStep[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  // Optional - only fetched in the full workflow detail query
  wiringSnapshot?: any;
  creator: GqlUserShort | null;
}
