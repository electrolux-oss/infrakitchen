import { useCallback, useState } from "react";

import { Entity, formatLabel } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { EditAffordance } from "../../common/components/editors/EditAffordance";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { Label } from "../../common/components/labels";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { dashedAddButtonClass } from "../../common/utils/dashedAddButton";
import { HeroPlusCircleIcon } from "../../icons";
import { Button } from "../../ui";
import { DataTable, DataTableColumn } from "../../ui";
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

// Read-only presentation of the secret list: a compact DataTable. Values are
// masked — only names ever render in plain text.
const SecretListTable = ({ secrets }: { secrets: CustomSecret[] }) => {
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
        <p className="m-0 font-mono text-body2 text-fg-muted">
          {params.value
            ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
            : ""}
        </p>
      ),
    },
  ];

  const rows = secrets.map((secret, index) => ({
    id: `${secret.name}-${index}`,
    name: secret.name,
    value: secret.value,
  }));

  return (
    <div className="overflow-hidden rounded-surface border border-divider bg-paper">
      <DataTable rows={rows} columns={columns} hideFooter density="compact" />
    </div>
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

  const editAffordance = (
    <EditAffordance
      onClick={startEditList}
      ariaLabel="Edit secret list"
      title="Edit secret list"
      disabled={!canEdit}
      disabledTooltip="You do not have permission to edit this section"
    />
  );

  return (
    <BaseCard name="Secret Configuration">
      <CommonField
        name={"Integration"}
        value={
          secret.integration ? (
            <Entity entity={secret.integration} providerIconSize={18} />
          ) : null
        }
      />
      <CommonField
        name={"Secret Provider"}
        value={getProviderValue(secret.secretProvider, 18)}
      />
      <CommonField name={"Secret Type"} value={secret.secretType} />
      {isCustom ? (
        <CommonField
          span="full"
          name={
            <div className="flex items-center gap-2">
              Secret List
              <Label label={String(secretList.length)} />
            </div>
          }
          value={
            editingList ? (
              <div className="w-full">
                <CustomSecretInput
                  label="Secret list"
                  hideHeader
                  errors={{}}
                  value={draftSecrets}
                  onChange={setDraftSecrets}
                />
                <div
                  // Align with the editor rows (inset by px: 2).
                  className="mt-2 flex items-center justify-between gap-2 px-4"
                >
                  {/* Dashed "Add" action shared with the other list editors. */}
                  <Button
                    startIcon={<HeroPlusCircleIcon />}
                    onClick={addSecret}
                    className={dashedAddButtonClass}
                  >
                    Add
                  </Button>
                  <div className="flex gap-2">
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
                  </div>
                </div>
              </div>
            ) : secretList.length > 0 ? (
              <div className="flex items-start gap-1">
                <div className="min-w-0 grow">
                  <SecretListTable secrets={secretList} />
                </div>
                {editAffordance}
              </div>
            ) : (
              <div className="inline-flex max-w-full items-center gap-1">
                <PlaceholderText />
                {editAffordance}
              </div>
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
