import { usePermissionProvider } from "../../common/context";

/**
 * Selecting the worker template of a resource or an executor needs access to worker templates,
 * as templates differ in what their workers can reach; everyone else gets the global default.
 */
export const useCanSelectWorkerTemplate = (): boolean => {
  const { permissions } = usePermissionProvider();
  return permissions["*"] === "admin" || !!permissions["api:worker_template"];
};
