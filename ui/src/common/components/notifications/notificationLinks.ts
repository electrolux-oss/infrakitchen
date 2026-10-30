const ENTITY_PATHS: Record<string, string> = {
  resource: "resources",
  workspace: "workspaces",
  storage: "storages",
  executor: "executors",
  source_code: "source_codes",
  source_code_version: "source_code_versions",
  workflow: "workflows",
  tool: "tools",
  secret: "secrets",
  template: "templates",
  integration: "integrations",
  auth_provider: "auth_providers",
  worker_template: "worker_templates",
};

const ENTITY_LABELS: Record<string, string> = {
  resource: "View resource",
  workspace: "View workspace",
  storage: "View storage",
  executor: "View executor",
  source_code: "View source code",
  source_code_version: "View source code version",
  workflow: "View workflow",
  tool: "View tool",
  secret: "View secret",
  template: "View template",
  integration: "View integration",
  auth_provider: "View auth provider",
  worker_template: "View worker template",
};

export interface NotificationEntityLink {
  to: string;
  label: string;
}

/** Link to the entity a notification is about, or undefined when it has no detail page.
 * Plan/apply results of a resource open its Audit tab, where the run is listed. */
export const getNotificationEntityLink = (
  linkPrefix: string,
  entityType?: string | null,
  entityId?: string | null,
  eventType?: string | null,
): NotificationEntityLink | undefined => {
  const segment = entityType ? ENTITY_PATHS[entityType] : undefined;
  if (!segment || !entityId) {
    return undefined;
  }
  const tab =
    entityType === "resource" && eventType === "execute" ? "/audit" : "";
  return {
    to: `${linkPrefix}${segment}/${entityId}${tab}`,
    label: ENTITY_LABELS[entityType!] ?? "View",
  };
};
