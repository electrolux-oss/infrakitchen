import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import { PropertyCard } from "../../../common/components/cards/PropertyCard";
import { useConfig } from "../../../common/context";
import { notify, notifyError } from "../../../common/hooks/useNotification";
import { toolLabel } from "../../../tools";
import {
  DELETE_IAC_ENVIRONMENT_CONFIG_MUTATION,
  GqlIacEnvironmentConfig,
  GqlIacModule,
  IAC_ENVIRONMENT_CONFIGS_QUERY,
} from "../../graphql";

import { IacEnvironmentDialog } from "./IacEnvironmentDialog";

export const useIacEnvironmentConfigs = (sourceCodeId: string) => {
  const { ikApi } = useConfig();
  const [configs, setConfigs] = useState<GqlIacEnvironmentConfig[]>([]);

  const reload = useCallback(async () => {
    try {
      const response = await ikApi.graphqlRequest<{
        iacEnvironmentConfigs: GqlIacEnvironmentConfig[];
      }>(IAC_ENVIRONMENT_CONFIGS_QUERY, { sourceCodeId });
      setConfigs(response.iacEnvironmentConfigs || []);
    } catch (error) {
      notifyError(error);
    }
  }, [ikApi, sourceCodeId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { configs, reload };
};

const variablesSummary = (config: GqlIacEnvironmentConfig): string => {
  const count = Object.keys(config.variables ?? {}).length;
  const regions = Object.keys(config.regionVariables ?? {}).length;
  if (!count && !regions) return "None";
  return [
    count ? `${count} set` : null,
    regions ? `overrides in ${regions} region${regions > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(", ");
};

interface IacEnvironmentsProps {
  sourceCodeId: string;
  modules: GqlIacModule[];
  // Environments of the discovered modules, in promotion order
  environmentNames: string[];
  canEdit: boolean;
}

export const IacEnvironments = ({
  sourceCodeId,
  modules,
  environmentNames,
  canEdit,
}: IacEnvironmentsProps) => {
  const { ikApi } = useConfig();
  const { configs, reload } = useIacEnvironmentConfigs(sourceCodeId);
  const [editing, setEditing] = useState<string | null>(null);

  const configsByName = new Map(configs.map((config) => [config.name, config]));
  // Configured environments that are no longer discovered are listed too, so they can be removed.
  const names = [
    ...environmentNames,
    ...configs
      .map((config) => config.name)
      .filter((name) => !environmentNames.includes(name)),
  ];

  const remove = async (config: GqlIacEnvironmentConfig) => {
    try {
      await ikApi.graphqlRequest(DELETE_IAC_ENVIRONMENT_CONFIG_MUTATION, {
        id: config.id,
      });
      notify(`Environment ${config.name} removed`, "success");
      await reload();
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <PropertyCard
      title="Environments"
      subtitle="Credentials, state and tofu version each environment is run with"
    >
      {names.length === 0 ? (
        <Alert severity="info">No environments were discovered.</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Environment</TableCell>
              <TableCell>Cloud Integration</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Regions</TableCell>
              <TableCell>Variables</TableCell>
              <TableCell>Tofu</TableCell>
              {canEdit && <TableCell align="right" />}
            </TableRow>
          </TableHead>
          <TableBody>
            {names.map((name) => {
              const config = configsByName.get(name) ?? null;
              const discovered = environmentNames.includes(name);
              return (
                <TableRow key={name}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="body2">{name}</Typography>
                      {!discovered && (
                        <Chip size="small" label="Not discovered" />
                      )}
                    </Box>
                  </TableCell>
                  {config ? (
                    <>
                      <TableCell>
                        {config.integrations.length
                          ? config.integrations
                              .map((integration) => integration.name)
                              .join(", ")
                          : "None"}
                      </TableCell>
                      <TableCell>
                        {config.storage ? (
                          <>
                            {config.storage.name}
                            <Typography
                              variant="caption"
                              component="div"
                              sx={{
                                color: "text.secondary",
                                fontFamily: "monospace",
                              }}
                            >
                              {config.statePathTemplate}
                            </Typography>
                          </>
                        ) : (
                          "Backend block of the module"
                        )}
                      </TableCell>
                      <TableCell>
                        {config.regions?.length
                          ? config.regions.join(", ")
                          : "From the repository"}
                        {config.regionVariable && (
                          <Typography
                            variant="caption"
                            component="div"
                            sx={{
                              color: "text.secondary",
                              fontFamily: "monospace",
                            }}
                          >
                            var.{config.regionVariable}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{variablesSummary(config)}</TableCell>
                      <TableCell>
                        {config.tool ? toolLabel(config.tool) : "Default"}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={5} sx={{ color: "text.secondary" }}>
                      Not configured, its modules cannot be run yet
                    </TableCell>
                  )}
                  {canEdit && (
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button size="small" onClick={() => setEditing(name)}>
                        {config ? "Edit" : "Configure"}
                      </Button>
                      {config && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => void remove(config)}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {editing !== null && (
        <IacEnvironmentDialog
          sourceCodeId={sourceCodeId}
          environmentName={editing}
          modules={modules}
          config={configsByName.get(editing) ?? null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </PropertyCard>
  );
};
