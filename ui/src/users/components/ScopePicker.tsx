import { useMemo } from "react";

import { useConfig } from "../../common";
import { Alert, MenuItem, Select, Switch } from "../../ui";
import { cn } from "../../utils/cn";

// Entity/action pairs offered for scoped tokens, derived from the owner's own
// bootstrap permissions. Admin is intentionally excluded: scoped tokens never
// carry admin authority.
const SCOPE_ACTIONS = ["read", "write"] as const;

// Only entities reachable from the sidebar menu are offered, labelled as in the
// menu. Internal entities (not listed here) are never shown to the user.
// Grouped and ordered as in the menu.
const SCOPE_GROUPS: { title: string; entities: [string, string][] }[] = [
  {
    title: "General",
    entities: [
      ["project", "Projects"],
      ["service", "Services"],
      ["template", "Templates"],
      ["source_code_version", "Template Versions"],
      ["resource", "Resources"],
      ["batch_operation", "Batch Operations"],
      ["executor", "Executors"],
      ["blueprint", "Blueprints"],
    ],
  },
  {
    title: "Configurations",
    entities: [
      ["integration", "Integrations"],
      ["source_code", "Code Repositories"],
      ["workspace", "Workspaces"],
      ["storage", "Storage"],
      ["secret", "Secrets"],
      ["tool", "IaC Tools"],
    ],
  },
  {
    title: "Operations",
    entities: [
      ["task", "Tasks"],
      ["workflow", "Workflows"],
      ["worker", "Workers"],
    ],
  },
  {
    title: "Management",
    entities: [
      ["user", "Users"],
      ["permission", "Roles"],
      ["audit_log", "Audit Logs"],
    ],
  },
];

const SCOPE_ENTITY_LABELS: Record<string, string> = Object.fromEntries(
  SCOPE_GROUPS.flatMap((group) => group.entities),
);
const SCOPE_ENTITY_GROUP: Record<string, string> = Object.fromEntries(
  SCOPE_GROUPS.flatMap((group) =>
    group.entities.map(([entity]) => [entity, group.title]),
  ),
);
const SCOPE_ENTITY_ORDER = SCOPE_GROUPS.flatMap((group) =>
  group.entities.map(([entity]) => entity),
);
const byMenuOrder = (a: string, b: string) =>
  SCOPE_ENTITY_ORDER.indexOf(a) - SCOPE_ENTITY_ORDER.indexOf(b);

const normalizeAction = (action: string | undefined) => {
  // "admin" implies both read and write for scoping purposes.
  if (action === "admin") return SCOPE_ACTIONS;
  if (action === "write") return SCOPE_ACTIONS;
  if (action === "read") return ["read"];
  return [];
};

export interface AvailableScope {
  entity: string;
  actions: string[];
}

// Entities the current user can act on, with the actions scoping permits. Keys
// arrive as "api:<entity>" (and "*" for super admins); a super admin's
// wildcard implies read+write on every entity the server knows about.
export const useAvailableScopes = (): AvailableScope[] => {
  const { bootstrapPermissions, entities } = useConfig();

  return useMemo(() => {
    if (!bootstrapPermissions) return [] as AvailableScope[];
    const stripApiPrefix = (key: string) => key.replace(/^api:/, "");

    if (bootstrapPermissions["*"] === "admin") {
      const entityNames = new Set<string>([
        ...Object.keys(bootstrapPermissions)
          .filter((key) => key !== "*")
          .map(stripApiPrefix),
        ...(entities ?? []),
      ]);
      return Array.from(entityNames)
        .filter((entity) => entity in SCOPE_ENTITY_LABELS)
        .sort(byMenuOrder)
        .map((entity) => ({
          entity,
          actions: SCOPE_ACTIONS.slice() as string[],
        }));
    }

    return Object.entries(bootstrapPermissions)
      .filter(([key]) => key !== "*")
      .map(([key, action]) => ({
        entity: stripApiPrefix(key),
        actions: normalizeAction(action).slice(),
      }))
      .filter(({ entity }) => entity in SCOPE_ENTITY_LABELS)
      .sort((a, b) => byMenuOrder(a.entity, b.entity));
  }, [bootstrapPermissions, entities]);
};

export const readOnlyScopesFor = (availableScopes: AvailableScope[]) =>
  availableScopes
    .filter(({ actions }) => actions.includes("read"))
    .map(({ entity }) => `read:${entity}`);

interface ScopePickerProps {
  availableScopes: AvailableScope[];
  selectedScopes: Set<string>;
  onChange: (scopes: Set<string>) => void;
  // Shown under the header when nothing / something is selected.
  emptySelectionNote: string;
  selectionNote: string;
  subject?: string;
}

export const ScopePicker = ({
  availableScopes,
  selectedScopes,
  onChange,
  emptySelectionNote,
  selectionNote,
  subject = "A token",
}: ScopePickerProps) => {
  const readOnlyScopes = readOnlyScopesFor(availableScopes);
  const readWriteScopes = availableScopes.flatMap(({ entity, actions }) =>
    actions.map((action) => `${action}:${entity}`),
  );
  const matchesSelection = (scopes: string[]) =>
    scopes.length > 0 &&
    scopes.length === selectedScopes.size &&
    scopes.every((scope) => selectedScopes.has(scope));
  const readOnlyActive = matchesSelection(readOnlyScopes);
  const canGrantWrite = availableScopes.some(({ actions }) =>
    actions.includes("write"),
  );
  const readWriteActive = canGrantWrite && matchesSelection(readWriteScopes);
  const groupLevel = (group: string) => {
    const levels = new Set(
      availableScopes
        .filter(({ entity }) => SCOPE_ENTITY_GROUP[entity] === group)
        .map(({ entity }) =>
          selectedScopes.has(`write:${entity}`)
            ? "write"
            : selectedScopes.has(`read:${entity}`)
              ? "read"
              : "none",
        ),
    );
    return levels.size === 1 ? Array.from(levels)[0] : "mixed";
  };

  // Sets every entity in a group to the given level (capped at what the owner
  // may grant), leaving other groups untouched.
  const selectGroup = (group: string, level: "none" | "read" | "write") => {
    const updated = new Set(selectedScopes);
    availableScopes
      .filter(({ entity }) => SCOPE_ENTITY_GROUP[entity] === group)
      .forEach(({ entity, actions }) => {
        updated.delete(`read:${entity}`);
        updated.delete(`write:${entity}`);
        if (level !== "none" && actions.includes("read")) {
          updated.add(`read:${entity}`);
        }
        if (level === "write" && actions.includes("write")) {
          updated.add(`write:${entity}`);
        }
      });
    onChange(updated);
  };

  const selectEntity = (entity: string, level: string) => {
    const updated = new Set(selectedScopes);
    updated.delete(`read:${entity}`);
    updated.delete(`write:${entity}`);
    if (level === "read" || level === "write") {
      updated.add(`read:${entity}`);
    }
    if (level === "write") {
      updated.add(`write:${entity}`);
    }
    onChange(updated);
  };

  if (availableScopes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-caption text-fg-muted">Permissions</span>
        <div className="flex items-center gap-3">
          {(
            [
              [
                "All read only",
                readOnlyActive || readWriteActive,
                readOnlyScopes,
              ],
              ["All read and write", readWriteActive, readWriteScopes],
            ] as const
          ).map(([label, active, scopes]) => (
            <label
              key={label}
              className="flex cursor-pointer items-center gap-1 text-body2"
            >
              <Switch
                checked={active}
                disabled={
                  label === "All read only" ? readWriteActive : !canGrantWrite
                }
                onChange={() => onChange(new Set(active ? [] : scopes))}
                inputProps={{ "aria-label": label }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <p
        className={cn(
          "mt-0.5 mb-2 text-caption",
          selectedScopes.size > 0
            ? "text-fg-muted"
            : "font-semibold text-tint-orange-500 dark:text-tint-orange-300",
        )}
      >
        {selectedScopes.size > 0 ? selectionNote : emptySelectionNote}
      </p>
      <div className="max-h-[40vh] overflow-y-auto rounded-surface border border-divider">
        {availableScopes.map(({ entity, actions }, index) => (
          <div key={entity}>
            {(index === 0 ||
              SCOPE_ENTITY_GROUP[entity] !==
                SCOPE_ENTITY_GROUP[availableScopes[index - 1].entity]) && (
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-divider bg-canvas px-3 py-0.5">
                <span className="text-caption font-semibold tracking-wide text-fg-muted uppercase">
                  {SCOPE_ENTITY_GROUP[entity]}
                </span>
                <Select<string>
                  size="small"
                  className="w-40 shrink-0"
                  aria-label={`${SCOPE_ENTITY_GROUP[entity]} access`}
                  value={groupLevel(SCOPE_ENTITY_GROUP[entity])}
                  onChange={(event) =>
                    selectGroup(
                      SCOPE_ENTITY_GROUP[entity],
                      event.target.value as "none" | "read" | "write",
                    )
                  }
                >
                  <MenuItem value="mixed" disabled className="hidden">
                    Mixed
                  </MenuItem>
                  <MenuItem value="none">-- Select --</MenuItem>
                  <MenuItem value="read">Read only</MenuItem>
                  <MenuItem value="write">Read and write</MenuItem>
                </Select>
              </div>
            )}
            <div className="flex flex-row items-center justify-between gap-4 px-3 py-1">
              <p className="m-0 text-body2">{SCOPE_ENTITY_LABELS[entity]}</p>
              <Select<string>
                size="small"
                className="w-40 shrink-0"
                aria-label={`${SCOPE_ENTITY_LABELS[entity]} access`}
                value={
                  selectedScopes.has(`write:${entity}`)
                    ? "write"
                    : selectedScopes.has(`read:${entity}`)
                      ? "read"
                      : "none"
                }
                onChange={(event) => selectEntity(entity, event.target.value)}
              >
                <MenuItem value="none">-- Select --</MenuItem>
                <MenuItem value="read" disabled={!actions.includes("read")}>
                  Read only
                </MenuItem>
                <MenuItem value="write" disabled={!actions.includes("write")}>
                  Read and write
                </MenuItem>
              </Select>
            </div>
          </div>
        ))}
      </div>
      <Alert className="mt-2" severity="info" variant="outlined">
        {subject} cannot have more access than you do, so options above your own
        permission level cannot be selected.
      </Alert>
    </div>
  );
};
