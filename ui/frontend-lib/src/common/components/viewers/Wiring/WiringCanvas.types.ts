import { GenericTemplate, WiringRule } from "./types";

export interface TemplatePorts {
  inputs: string[];
  outputs: string[];
}

export interface WiringCanvasExternalTemplate {
  id: string;
  name: string;
  abstract?: boolean;
}

export type ConstantType = "string" | "number";

export interface WiringCanvasConstantBlock {
  id: string;
  name: string;
  type: ConstantType;
  defaultValue?: string;
}

export interface WiringCanvasProps {
  selectedTemplates: GenericTemplate[];
  wiring: WiringRule[];
  onWiringChange: (wiring: WiringRule[]) => void;
  templatePorts: Record<string, TemplatePorts>;
  onTemplateAdd: (template: GenericTemplate) => void;
  onTemplateRemove: (templateId: string) => void;
  externalTemplates: WiringCanvasExternalTemplate[];
  onExternalTemplateAdd: (template: WiringCanvasExternalTemplate) => void;
  onExternalTemplateRemove: (templateId: string) => void;
  missingParentTemplates: WiringCanvasExternalTemplate[];
  constants: WiringCanvasConstantBlock[];
  onConstantAdd: (type: ConstantType) => void;
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate: (
    constantId: string,
    defaultValue: string,
  ) => void;
}
