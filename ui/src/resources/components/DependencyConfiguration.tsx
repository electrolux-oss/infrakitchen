import { useCallback, useState } from "react";

import { BaseCard } from "../../common/components/cards/BaseCard";
import { EditAffordance } from "../../common/components/editors/EditAffordance";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import TagInput from "../../common/components/inputs/TagInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { dashedAddButtonClass } from "../../common/utils/dashedAddButton";
import { AddIcon } from "../../icons/material";
import { Switch, Button, Chip, Tooltip } from "../../ui";
import { DataTable, DataTableColumn } from "../../ui";
import {
  ResourceUpdateFieldInput,
  UPDATE_RESOURCE_MUTATION,
} from "../graphql/mutations";
import { DependencyVariable } from "../types";

export interface DependencyConfigurationProps {
  resource: {
    id: string;
    dependencyTags: DependencyVariable[] | null;
    dependencyConfig: DependencyVariable[] | null;
  };
  updateMutation?: string;
  toUpdateInput?: (input: ResourceUpdateFieldInput) => Record<string, any>;
  permissionEntity?: string;
}

const DependencyVariablesTable = ({
  variables,
}: {
  variables: DependencyVariable[];
}) => {
  const columns: DataTableColumn<any>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <p className="m-0 font-mono text-body2">{params.value}</p>
      ),
    },
    {
      field: "value",
      headerName: "Value",
      flex: 2.5,
      sortable: false,
      renderCell: (params) => (
        <p className="m-0 font-mono text-body2">{params.value}</p>
      ),
    },
    {
      field: "inherited_by_children",
      headerName: "Inherited By Children",
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Tooltip
          title={
            params.value ? "Inherited by children" : "Not inherited by children"
          }
        >
          <Switch
            className="pointer-events-none cursor-default"
            checked={Boolean(params.value)}
          />
        </Tooltip>
      ),
    },
  ];

  const list = Array.isArray(variables) ? variables : asVariableList(variables);
  const rows = list.map((variable, index) => ({
    id: `${String(variable.name ?? "")}-${index}`,
    ...variable,
  }));

  return (
    <div className="overflow-hidden rounded-surface border border-divider bg-paper">
      <DataTable rows={rows} columns={columns} hideFooter density="compact" />
    </div>
  );
};

// Normalize the runtime shape of dependency tags/configs. GraphQL models these
// as arrays, but older stored data can arrive as an object (key → value or
// key → { value, inherited_by_children }) — tolerate both without crashing.
const asVariableList = (variables: unknown): DependencyVariable[] => {
  if (Array.isArray(variables)) {
    return variables as DependencyVariable[];
  }
  if (variables && typeof variables === "object") {
    return Object.entries(variables as Record<string, any>).map(
      ([key, entry]) => {
        if (entry && typeof entry === "object") {
          return {
            name: String(entry.name ?? key),
            value: entry.value == null ? "" : String(entry.value),
            inherited_by_children: Boolean(
              entry.inherited_by_children ?? false,
            ),
          };
        }
        return {
          name: key,
          value: entry == null ? "" : String(entry),
          inherited_by_children: false,
        };
      },
    );
  }
  return [];
};

const getDependencyVariables = (variables: unknown) => {
  const list = asVariableList(variables);
  return list.length > 0 ? (
    <DependencyVariablesTable variables={list} />
  ) : (
    <PlaceholderText />
  );
};

export const DependencyConfiguration = ({
  resource,
  updateMutation = UPDATE_RESOURCE_MUTATION,
  toUpdateInput = (input) => input,
  permissionEntity = "api:resource",
}: DependencyConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission(permissionEntity, "write");

  type DependencySection = "tags" | "configs";
  const [editingSection, setEditingSection] =
    useState<DependencySection | null>(null);
  const [draft, setDraft] = useState<DependencyVariable[]>([]);
  const [saving, setSaving] = useState(false);

  const startEdit = (section: DependencySection) => {
    const current = asVariableList(
      section === "tags" ? resource.dependencyTags : resource.dependencyConfig,
    );
    setDraft(
      current.map((t) => ({
        name: t.name,
        value: t.value,
        inherited_by_children: t.inherited_by_children,
      })),
    );
    setEditingSection(section);
  };

  const renderSectionHeader = (label: string, count: number) => (
    <div className="mb-2 flex items-center gap-2">
      <p className="m-0 text-body2 font-semibold">{label}</p>
      <Chip label={String(count)} appearance="solid" color="info" compact />
    </div>
  );

  // Pencil edit affordance that sits beside the displayed value (e.g. on the
  // "Not set" line), same always-visible pencil as the editable fields.
  const renderEditAffordance = (
    onEdit: () => void,
    canEdit: boolean,
    label: string,
  ) => {
    const ariaLabel = `Edit ${label.toLowerCase()}`;
    return (
      <EditAffordance
        onClick={onEdit}
        ariaLabel={ariaLabel}
        title={ariaLabel}
        disabled={!canEdit}
        disabledTooltip="You do not have permission to edit this section"
      />
    );
  };

  const saveField = useCallback(
    async (input: ResourceUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(updateMutation, {
          id: resource.id,
          input: toUpdateInput(input),
        });
        notify("Resource updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, refreshEntity, resource.id, toUpdateInput, updateMutation],
  );

  const handleSave = async () => {
    if (!editingSection) return;
    const hasIncomplete = draft.some(
      (entry) => !entry.name?.trim() || !entry.value?.trim(),
    );
    if (hasIncomplete) {
      notifyError(new Error("All entries must have both a name and a value"));
      return;
    }

    setSaving(true);
    try {
      await saveField(
        editingSection === "tags"
          ? { dependencyTags: draft }
          : { dependencyConfig: draft },
      );
      setEditingSection(null);
    } catch {
      // Error surfaced by saveField; keep editing open
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (
    section: DependencySection,
    label: string,
    values: DependencyVariable[] | null,
  ) => {
    const entries = asVariableList(values);
    const editing = editingSection === section;
    const count = editing ? draft.length : entries.length;
    const addEntry = () =>
      setDraft([
        ...draft,
        { name: "", value: "", inherited_by_children: true },
      ]);
    return (
      <div className="col-span-full">
        <div className="mt-4">
          {renderSectionHeader(label, count)}
          {editing ? (
            <>
              <TagInput
                label={label}
                hideHeader
                errors={{}}
                value={draft}
                onChange={setDraft}
              />
              <div
                // Align with the TagInput rows, which are inset by px: 2.
                className="mt-2 flex items-center justify-between gap-2 px-4"
              >
                {/* Dashed "Add" action shared with the other list editors. */}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addEntry}
                  className={dashedAddButtonClass}
                >
                  Add
                </Button>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setEditingSection(null)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </>
          ) : entries.length > 0 ? (
            <div className="flex items-start gap-1">
              <div className="min-w-0 grow">
                {getDependencyVariables(entries)}
              </div>
              {renderEditAffordance(() => startEdit(section), canEdit, label)}
            </div>
          ) : (
            <div className="inline-flex max-w-full items-center gap-1">
              {getDependencyVariables(entries)}
              {renderEditAffordance(() => startEdit(section), canEdit, label)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <BaseCard name="Dependency Configuration">
        {renderSection("tags", "Dependency Tags", resource.dependencyTags)}
        {renderSection(
          "configs",
          "Dependency Configs",
          resource.dependencyConfig,
        )}
      </BaseCard>
    </div>
  );
};
