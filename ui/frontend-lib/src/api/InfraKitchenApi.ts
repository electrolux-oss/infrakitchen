import { ResourceVariableSchema } from "../resources/types";
import { GetListParams, GetListResult, IkEntity } from "../types";

/** @public */
export interface InfraKitchenApi {
  getToken: () => Promise<string | null>;
  getList: <RecordType extends IkEntity = any>(
    resource: string,
    params: GetListParams,
  ) => Promise<GetListResult<RecordType>>;

  getVariableSchema: (
    id: string,
    parent_resources?: string[],
  ) => Promise<ResourceVariableSchema[]>;

  getTree: (
    component: string,
    id: number | string,
    direction: "parents" | "children",
  ) => Promise<any>;
  downloadFile(path: string): Promise<ArrayBuffer>;

  // roles and permissions
  deleteRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  patchRaw: (path: string, params: { [key: string]: any }) => Promise<any>;
  postRaw: (path: string, params: { [key: string]: any }) => Promise<any>;

  updateRaw: (path: string, params: { [key: string]: any }) => Promise<any>;

  get(path: string, params?: Record<string, any>): Promise<any>;
}
