import { ReactNode, useMemo, useState } from "react";

import {
  Autocomplete,
  Box,
  Button,
  Chip,
  TextField,
  Typography,
} from "@mui/material";

import { CommonDialog } from "../../../common/components/dialogs/CommonDialog";
import ReferenceInput from "../../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../../common/context";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { ToolSelect } from "../../../tools";
import { IkEntity } from "../../../types";
import {
  CREATE_IAC_ENVIRONMENT_CONFIG_MUTATION,
  DEFAULT_STATE_PATH_TEMPLATE,
  environmentDiscovery,
  GqlIacEnvironmentConfig,
  GqlIacModule,
  UPDATE_IAC_ENVIRONMENT_CONFIG_MUTATION,
} from "../../graphql";

import {
  IacVariablesEditor,
  MissingVariables,
  toRecord,
  toRows,
  VariableRow,
} from "./IacVariablesEditor";

interface IacEnvironmentDialogProps {
  sourceCodeId: string;
  environmentName: string;
  modules: GqlIacModule[];
  // null when the environment is not configured yet
  config: GqlIacEnvironmentConfig | null;
  onClose: () => void;
  onSaved: () => void;
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
    <Typography
      variant="overline"
      sx={{ color: "text.secondary", lineHeight: 1.5 }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

export const IacEnvironmentDialog = ({
  sourceCodeId,
  environmentName,
  modules,
  config,
  onClose,
  onSaved,
}: IacEnvironmentDialogProps) => {
  const { ikApi } = useConfig();
  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [integrationId, setIntegrationId] = useState<string | null>(
    config?.integrations[0]?.id ?? null,
  );
  const integrationIds = useMemo(
    () => (integrationId ? [integrationId] : []),
    [integrationId],
  );
  const [storageId, setStorageId] = useState<string | null>(
    config?.storage?.id ?? null,
  );
  const [statePathTemplate, setStatePathTemplate] = useState(
    config?.statePathTemplate ?? DEFAULT_STATE_PATH_TEMPLATE,
  );
  const [toolId, setToolId] = useState<string | null>(config?.toolId ?? null);
  const [regions, setRegions] = useState<string[]>(config?.regions ?? []);
  const [regionVariable, setRegionVariable] = useState(
    config?.regionVariable ?? "",
  );
  const [variables, setVariables] = useState<VariableRow[]>(
    toRows(config?.variables),
  );
  const [regionVariables, setRegionVariables] = useState<
    Record<string, VariableRow[]>
  >(
    Object.fromEntries(
      Object.entries(config?.regionVariables ?? {}).map(([region, values]) => [
        region,
        toRows(values),
      ]),
    ),
  );
  const [saving, setSaving] = useState(false);

  const discovery = useMemo(
    () => environmentDiscovery(modules, environmentName),
    [modules, environmentName],
  );
  // Found in the repository, declared above, or still holding values to remove.
  const regionNames = [
    ...new Set([
      ...discovery.regions,
      ...regions,
      ...Object.keys(regionVariables),
    ]),
  ].sort();
  const environmentValues = toRecord(variables);
  const regionVariablesRecord = Object.fromEntries(
    Object.entries(regionVariables)
      .map(([region, rows]) => [region, toRecord(rows)] as const)
      .filter(([, values]) => Object.keys(values).length > 0),
  );

  // Storages that use the selected credentials, like for executors.
  const storageFilter = useMemo(
    () => ({ integration_id: integrationIds }),
    [integrationIds],
  );

  const save = async () => {
    setSaving(true);
    try {
      if (config) {
        await ikApi.graphqlRequest(UPDATE_IAC_ENVIRONMENT_CONFIG_MUTATION, {
          id: config.id,
          input: {
            integrationIds,
            ...(storageId ? { storageId } : { clearStorage: true }),
            ...(toolId ? { toolId } : { clearTool: true }),
            statePathTemplate,
            regions,
            // An empty string clears it.
            regionVariable,
            variables: environmentValues,
            regionVariables: regionVariablesRecord,
          },
        });
      } else {
        await ikApi.graphqlRequest(CREATE_IAC_ENVIRONMENT_CONFIG_MUTATION, {
          sourceCodeId,
          input: {
            name: environmentName,
            integrationIds,
            storageId,
            toolId,
            statePathTemplate,
            regions,
            regionVariable: regionVariable || null,
            variables: environmentValues,
            regionVariables: regionVariablesRecord,
          },
        });
      }
      notify(`Environment ${environmentName} saved`, "success");
      onSaved();
    } catch (error) {
      notifyError(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CommonDialog
      open
      maxWidth="md"
      fullWidth
      title={`${config ? "Edit" : "Configure"} environment ${environmentName}`}
      onClose={onClose}
      content={
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <Section title="Account">
            <ReferenceInput
              ikApi={ikApi}
              entity_name="integrations"
              filter={{ integration_type: "cloud" }}
              showFields={["integrationProvider", "name"]}
              buffer={buffer}
              setBuffer={setBuffer}
              value={integrationId}
              onChange={(id: string | null) => setIntegrationId(id)}
              label="Cloud Integration"
            />
          </Section>
          <Section title="State">
            <ReferenceInput
              ikApi={ikApi}
              entity_name="storages"
              filter={storageFilter}
              showFields={["name", "storage_provider"]}
              fields={["name", "storage_provider", "state"]}
              buffer={buffer}
              setBuffer={setBuffer}
              value={storageId}
              onChange={(id: string | null) => setStorageId(id)}
              getOptionDisabled={(option: any) =>
                option.state !== "PROVISIONED"
              }
              label="State Storage"
              helpertext="Empty: each module's own backend block is used"
            />
            {storageId && (
              <TextField
                label="State Path"
                value={statePathTemplate}
                onChange={(e) => setStatePathTemplate(e.target.value)}
                helperText="Placeholders: {module}, {module_name}, {env}"
                fullWidth
                size="small"
                slotProps={{ htmlInput: { "aria-label": "State path" } }}
              />
            )}
          </Section>
          <Section title="Regions">
            <Autocomplete
              multiple
              freeSolo
              // Keeps a typed region when the field loses focus, not only on Enter.
              autoSelect
              size="small"
              options={[]}
              value={regions}
              onChange={(_, value) =>
                setRegions(value.map((region) => region.trim()).filter(Boolean))
              }
              renderValue={(value, getItemProps) =>
                value.map((region, index) => {
                  const { key, ...itemProps } = getItemProps({ index });
                  return (
                    <Chip
                      key={key}
                      size="small"
                      label={region}
                      {...itemProps}
                    />
                  );
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Regions"
                  placeholder={regions.length ? undefined : "eu-west-1"}
                  helperText="Only when the repository has no region folders or var files"
                />
              )}
            />
            <TextField
              label="Region Variable"
              value={regionVariable}
              onChange={(e) => setRegionVariable(e.target.value)}
              placeholder="region"
              helperText="Optional: also passes the region as this variable"
              fullWidth
              size="small"
              slotProps={{ htmlInput: { "aria-label": "Region variable" } }}
            />
          </Section>
          <Section title="Variables">
            <IacVariablesEditor
              rows={variables}
              onChange={setVariables}
              declared={discovery.variables}
            />
            <MissingVariables
              declared={discovery.variables}
              values={environmentValues}
            />
            {regionNames.map((region) => (
              <Box
                key={region}
                sx={{ pl: 1.5, borderLeft: 2, borderColor: "divider" }}
              >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Only in {region}
                </Typography>
                <IacVariablesEditor
                  rows={regionVariables[region] ?? []}
                  onChange={(rows) =>
                    setRegionVariables((current) => ({
                      ...current,
                      [region]: rows,
                    }))
                  }
                  declared={discovery.variables}
                  inherited={environmentValues}
                />
              </Box>
            ))}
          </Section>
          <Section title="Tofu">
            <ToolSelect value={toolId} onChange={setToolId} label="Version" />
          </Section>
        </Box>
      }
      actions={
        <Button
          variant="contained"
          disabled={saving}
          onClick={() => void save()}
        >
          Save
        </Button>
      }
    />
  );
};
