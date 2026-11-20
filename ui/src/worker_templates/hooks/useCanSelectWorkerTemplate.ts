import { usePermissionProvider } from "../../common/context";
import type { GqlWorkerTemplateShort } from "../graphql";

/**
 * Selecting a worker template that isn't public needs access to worker templates,
 * as templates differ in what their workers can reach.
 */
export const useCanSelectWorkerTemplate = () => {
  const { permissions } = usePermissionProvider();
  const canSelectAny =
    permissions["*"] === "admin" || !!permissions["api:worker_template"];
  return {
    canSelectAny,
    canSelect: (template?: GqlWorkerTemplateShort | null) =>
      canSelectAny || !template || template.isPublic,
  };
};
