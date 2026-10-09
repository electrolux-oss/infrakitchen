const ENTITY_PATHS: Record<string, string> = {
  resource: "resources",
  workspace: "workspaces",
  storage: "storages",
  executor: "executors",
  source_code: "source_codes",
  secret: "secrets",
  template: "templates",
  integration: "integrations",
  auth_provider: "auth_providers",
};

const ENTITY_LABELS: Record<string, string> = {
  resource: "View resource",
  workspace: "View workspace",
  storage: "View storage",
  executor: "View executor",
  source_code: "View source code",
  secret: "View secret",
  template: "View template",
  integration: "View integration",
  auth_provider: "View auth provider",
};

export interface NotificationEntityLink {
  to: string;
  label: string;
}

/** Link to the entity a notification is about, or undefined when it has no detail page. */
export const getNotificationEntityLink = (
  linkPrefix: string,
  entityType?: string | null,
  entityId?: string | null,
): NotificationEntityLink | undefined => {
  const segment = entityType ? ENTITY_PATHS[entityType] : undefined;
  if (!segment || !entityId) {
    return undefined;
  }
  return {
    to: `${linkPrefix}${segment}/${entityId}`,
    label: ENTITY_LABELS[entityType!] ?? "View",
  };
};
