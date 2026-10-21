import { GenericTemplate, WiringRule } from "./types";

/** What a template says about one of its input variables. */
export interface InputMeta {
  required: boolean;
  /** The variable's default; unset or null when it has none. */
  default?: unknown;
}

export interface TemplateReference {
  input: string;
  sourceTemplateId: string;
  output: string;
}

export interface TemplateAncestor {
  id: string;
  name: string;
  /** The template this one is a direct parent of. */
  childId: string;
}

export interface TemplatePorts {
  inputs: string[];
  outputs: string[];
  /** Required flag and default per input name. */
  inputMeta?: Record<string, InputMeta>;
  /** Inputs the template takes from a parent template's output at run time. */
  references?: TemplateReference[];
  /** Templates above this one in the parent chain. */
  ancestors?: TemplateAncestor[];
  /** Required configuration variables, both a source and a target of wires */
  configs?: string[];
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
  /** `id` is set when the canvas needs it up front, e.g. to place a dropped constant. */
  onConstantAdd: (type: ConstantType, id?: string) => void;
  onConstantRemove: (constantId: string) => void;
  onConstantUpdate: (constantId: string, name: string) => void;
  onConstantDefaultValueUpdate: (
    constantId: string,
    defaultValue: string,
  ) => void;
}
