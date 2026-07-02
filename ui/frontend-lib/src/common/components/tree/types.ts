export interface TreeResponse {
  id: string;
  nodeId: string;
  name: string;
  state?: string;
  status: string;
  templateName?: string;
  children: TreeResponse[];
}
