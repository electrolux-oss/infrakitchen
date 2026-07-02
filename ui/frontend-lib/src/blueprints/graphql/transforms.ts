import { GqlTemplateShort } from "../../templates/graphql";
import { GqlUserShort } from "../../users/graphql";
import { GqlValidationRule } from "../../validation_rules/graphql";
import { GqlWorkflow } from "../../workflows/graphql";

interface GqlTemplateWithParents extends GqlTemplateShort {
  parents: GqlTemplateShort[];
}

export interface GqlBlueprint {
  id: string;
  name: string;
  entityName: string;
  description: string | null;
  templates: GqlTemplateShort[];
  externalTemplates: GqlTemplateShort[] | null;
  wiring: any;
  defaultVariables: any;
  configuration: any;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  creator: GqlUserShort | null;
  workflows: GqlWorkflow[] | null;
  createdAt: string;
  updatedAt: string;
}

export type GqlBlueprintOptional = Partial<GqlBlueprint> & {
  id: string;
  name: string;
  entityName: string;
};

export interface GqlBlueprintUse {
  id: string;
  name: string;
  templates: GqlTemplateWithParents[];
  externalTemplates: GqlTemplateShort[] | null;
  wiring: any;
  configuration: any;
}

export interface GqlBlueprintResourceVariableSchema {
  name: string;
  type: string;
  description: string | null;
  options: string[];
  required: boolean;
  frozen: boolean;
  unique: boolean;
  sensitive: boolean;
  restricted: boolean;
  value: any | null;
  index: number;
  validationRules: GqlValidationRule[];
}
