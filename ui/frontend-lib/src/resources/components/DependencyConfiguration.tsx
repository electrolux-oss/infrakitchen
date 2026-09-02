import { useCallback, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import {
  dataGridDefaultProps,
  dataGridSx,
} from "../../common/components/entity_table/dataGridStyles";
import { PlaceholderText } from "../../common/components/PlaceholderDescription";
import { dashedAddButtonSx } from "../../common/utils/dashedAddButtonSx";
import { solidChipColorSx } from "../../common/utils/softChip";
import TagInput from "../../common/components/inputs/TagInput";
import { BaseCard } from "../../common/components/BaseCard";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
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
  const columns: GridColDef<any>[] = [
    {
      field: "name",
      headerName: "Name",
      flex: 1,
      sortable: false,
      renderCell: (params) => (
        <Typography sx={{ fontFamily: CODE_FONT_FAMILY }}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: "value",
      headerName: "Value",
      flex: 2.5,
      sortable: false,
      renderCell: (params) => (
        <Typography sx={{ fontFamily: CODE_FONT_FAMILY }}>
          {params.value}
        </Typography>
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
            checked={Boolean(params.value)}
            size="small"
            disableRipple
            sx={{ pointerEvents: "none", cursor: "default" }}
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
    <Box
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--template-surface-radius)",
        backgroundColor: "background.paper",
        overflow: "hidden",
      }}
    >
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        hideFooter
        density="compact"
        columnHeaderHeight={36}
        disableRowSelectionOnClick
        {...dataGridDefaultProps}
        sx={[
          dataGridSx,
          {
            // Compact rows: tighten the shared cell padding for these small
            // read-only tables.
            "& .MuiDataGrid-cell": { py: "2px" },
          },
        ]}
      />
    </Box>
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
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
      <Chip
        label={String(count)}
        sx={solidChipColorSx("info", undefined, undefined, true)}
      />
    </Box>
  );

  // Pencil edit affordance that sits beside the displayed value (e.g. on the
  // "Not set" line), revealed on hover/focus like other inline-editable fields.
  const renderEditAffordance = (
    onEdit: () => void,
    canEdit: boolean,
    label: string,
  ) => {
    const ariaLabel = `Edit ${label.toLowerCase()}`;
    const iconSx = {
      opacity: 0,
      transition: "opacity 0.15s ease-in-out",
      width: 24,
      height: 24,
      padding: 2,
      "&:focus-visible": { opacity: 1 },
    };
    return canEdit ? (
      <Tooltip title={ariaLabel}>
        <IconButton
          className="inline-edit-action"
          size="small"
          onClick={onEdit}
          aria-label={ariaLabel}
          sx={iconSx}
        >
          <EditOutlinedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : (
      <Tooltip title="You do not have permission to edit this section">
        <span>
          <IconButton
            className="inline-edit-action"
            size="small"
            disabled
            aria-label={ariaLabel}
            sx={iconSx}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
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
      <Grid size={12}>
        <Box sx={{ mt: 2 }}>
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
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 1,
                  mt: 1,
                  // Align with the TagInput rows, which are inset by px: 2.
                  px: 2,
                }}
              >
                {/* Dashed "Add" action shared with the other list editors. */}
                <Button
                  startIcon={<AddIcon />}
                  onClick={addEntry}
                  sx={dashedAddButtonSx}
                >
                  Add
                </Button>
                <Box sx={{ display: "flex", gap: 1 }}>
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
                </Box>
              </Box>
            </>
          ) : entries.length > 0 ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.5,
                // Reveal the edit affordance on hover/focus, like other
                // inline editors where it sits beside the displayed value.
                "&:hover .inline-edit-action, &:focus-within .inline-edit-action":
                  { opacity: 1 },
              }}
            >
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                {getDependencyVariables(entries)}
              </Box>
              {renderEditAffordance(() => startEdit(section), canEdit, label)}
            </Box>
          ) : (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                maxWidth: "100%",
                // Reveal the edit affordance on hover/focus, like other
                // inline editors where it sits beside the displayed value.
                "&:hover .inline-edit-action, &:focus-within .inline-edit-action":
                  { opacity: 1 },
              }}
            >
              {getDependencyVariables(entries)}
              {renderEditAffordance(() => startEdit(section), canEdit, label)}
            </Box>
          )}
        </Box>
      </Grid>
    );
  };

  return (
    <Box sx={{ gap: 2, display: "flex", flexDirection: "column" }}>
      <BaseCard name="Dependency Configuration">
        {renderSection("tags", "Dependency Tags", resource.dependencyTags)}
        {renderSection(
          "configs",
          "Dependency Configs",
          resource.dependencyConfig,
        )}
      </BaseCard>
    </Box>
  );
};
