export interface TreeResponse {
  id: string;
  node_id: string;
  name: string;
  state: string;
  status: string;
  template_name: string;
  children: TreeResponse[];
}
