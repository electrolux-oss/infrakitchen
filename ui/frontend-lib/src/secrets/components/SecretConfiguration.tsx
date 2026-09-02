import { useCallback, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import {
  dataGridDefaultProps,
  dataGridSx,
} from "../../common/components/entity_table/dataGridStyles";
import { BaseCard } from "../../common/components/BaseCard";
import { PlaceholderText } from "../../common/components/PlaceholderDescription";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
import { dashedAddButtonSx } from "../../common/utils/dashedAddButtonSx";
import { solidChipColorSx } from "../../common/utils/softChip";
import { GqlSecret } from "../graphql";
import {
  SecretUpdateFieldInput,
  UPDATE_SECRET_MUTATION,
} from "../graphql/mutations";
import { CustomSecret, SecretUpdate } from "../types";

import CustomSecretInput from "./CustomSecretInput";
import { SecretConfigurationField } from "./SecretConfigurationField";

export interface SecretConfigurationProps {
  secret: GqlSecret;
}

// Normalize the runtime shape of a custom-secret list (array, or key → entry
// dict) so the UI never assumes one shape.
const asSecretList = (secrets: unknown): CustomSecret[] => {
  if (Array.isArray(secrets)) {
    return secrets as CustomSecret[];
  }
  if (secrets && typeof secrets === "object") {
    return Object.entries(secrets as Record<string, any>).map(([key, entry]) =>
      entry && typeof entry === "object"
        ? {
            name: String(entry.name ?? key),
            value: entry.value == null ? "" : String(entry.value),
          }
        : { name: key, value: entry == null ? "" : String(entry) },
    );
  }
  return [];
};

// Read-only presentation of the secret list: a compact DataGrid. Values are
// masked — only names ever render in plain text.
const SecretListTable = ({ secrets }: { secrets: CustomSecret[] }) => {
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
        <Typography
          sx={{
            fontFamily: CODE_FONT_FAMILY,
            color: "text.secondary",
          }}
        >
          {params.value
            ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            : ""}
        </Typography>
      ),
    },
  ];

  const rows = secrets.map((secret, index) => ({
    id: `${secret.name}-${index}`,
    name: secret.name,
    value: secret.value,
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
            // Compact rows: tighten the shared cell padding for this small
            // read-only table.
            "& .MuiDataGrid-cell": { py: "2px" },
          },
          // Small embedded table: hug its rows instead of the shared min-height.
          { minHeight: "auto" },
        ]}
      />
    </Box>
  );
};

export const SecretConfiguration = ({ secret }: SecretConfigurationProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:secret", "write");

  const isCustom = secret.secretProvider === "custom";
  const secretList = asSecretList(secret.configuration?.secrets);

  const [editingList, setEditingList] = useState(false);
  const [draftSecrets, setDraftSecrets] = useState<CustomSecret[]>([]);
  const [savingSecrets, setSavingSecrets] = useState(false);

  const saveConfiguration = useCallback(
    async (configuration: SecretUpdate["configuration"]) => {
      const input: SecretUpdateFieldInput = {
        configuration,
        // secret_provider is the Pydantic discriminator for the configuration
        // union type; the backend needs it to deserialize the correct variant.
        secretProvider: secret.secretProvider,
      };
      try {
        await ikApi.graphqlRequest(UPDATE_SECRET_MUTATION, {
          id: secret.id,
          input,
        });
        notify("Secret updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, secret.id, secret.secretProvider, refreshEntity],
  );

  const startEditList = () => {
    setDraftSecrets(secretList.map((s) => ({ name: s.name, value: s.value })));
    setEditingList(true);
  };

  const addSecret = () => {
    setDraftSecrets([...draftSecrets, { name: "", value: "" }]);
  };

  const saveSecrets = async () => {
    const hasIncomplete = draftSecrets.some(
      (entry) => !entry.name?.trim() || !entry.value?.trim(),
    );
    if (hasIncomplete) {
      notifyError(new Error("All secrets must have both a name and a value"));
      return;
    }
    setSavingSecrets(true);
    try {
      await saveConfiguration({ secrets: draftSecrets });
      setEditingList(false);
    } catch {
      // Error surfaced by saveConfiguration; keep editing open
    } finally {
      setSavingSecrets(false);
    }
  };

  const editAffordance = (() => {
    const ariaLabel = "Edit secret list";
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
          onClick={startEditList}
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
  })();

  const hoverRevealSx = {
    "&:hover .inline-edit-action, &:focus-within .inline-edit-action": {
      opacity: 1,
    },
  };

  return (
    <BaseCard name="Secret Configuration">
      <CommonField
        name={"Integration"}
        value={
          secret.integration ? (
            <GetReferenceUrlValue
              {...secret.integration}
              urlProvider={secret.integration.integrationProvider}
            />
          ) : null
        }
      />
      <CommonField
        name={"Secret Provider"}
        value={getProviderValue(secret.secretProvider)}
      />
      <CommonField name={"Secret Type"} value={secret.secretType} />
      {isCustom ? (
        <CommonField
          size={12}
          name={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              Secret List
              <Chip
                label={String(secretList.length)}
                sx={solidChipColorSx("info", undefined, undefined, true)}
              />
            </Box>
          }
          value={
            editingList ? (
              <Box sx={{ width: "100%" }}>
                <CustomSecretInput
                  label="Secret list"
                  hideHeader
                  errors={{}}
                  value={draftSecrets}
                  onChange={setDraftSecrets}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    mt: 1,
                    // Align with the editor rows (inset by px: 2).
                    px: 2,
                  }}
                >
                  {/* Dashed "Add" action shared with the other list editors. */}
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addSecret}
                    sx={dashedAddButtonSx}
                  >
                    Add
                  </Button>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Button
                      onClick={() => setEditingList(false)}
                      disabled={savingSecrets}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={saveSecrets}
                      disabled={savingSecrets}
                    >
                      Save
                    </Button>
                  </Box>
                </Box>
              </Box>
            ) : secretList.length > 0 ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.5,
                  ...hoverRevealSx,
                }}
              >
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <SecretListTable secrets={secretList} />
                </Box>
                {editAffordance}
              </Box>
            ) : (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.5,
                  maxWidth: "100%",
                  ...hoverRevealSx,
                }}
              >
                <PlaceholderText />
                {editAffordance}
              </Box>
            )
          }
        />
      ) : (
        <>
          {Object.entries(secret.configuration || {}).map(([k, v]) => (
            <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
          ))}
          <SecretConfigurationField
            secret={secret}
            canEdit={canEdit}
            onSave={saveConfiguration}
          />
        </>
      )}
    </BaseCard>
  );
};
