import { NodeProps } from "@xyflow/react";

import { DiagramNode } from "./helpers";
import { TemplateNode } from "./TemplateNode";

export function ExternalNode(props: NodeProps<DiagramNode>) {
  return <TemplateNode {...props} />;
}
