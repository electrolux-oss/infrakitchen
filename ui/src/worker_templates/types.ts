import type { GqlWorkerTemplateShort } from "./graphql";

/** Workers of the global default: a template's, or static workers when none is set. */
export const defaultWorkersName = (
  defaultTemplate?: GqlWorkerTemplateShort | null,
): string => defaultTemplate?.name ?? "static workers";

/** Label of the workers used when an entity doesn't select a worker template. */
export const defaultWorkerTemplateLabel = (
  defaultTemplate?: GqlWorkerTemplateShort | null,
): string => `Global default: ${defaultWorkersName(defaultTemplate)}`;

export const isEnabledWorkerTemplate = (template: GqlWorkerTemplateShort) =>
  String(template.status).toLowerCase() === "enabled";
