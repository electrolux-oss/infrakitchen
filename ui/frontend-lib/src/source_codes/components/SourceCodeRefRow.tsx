import { useEffect, useState } from "react";
import React from "react";

import { FormProvider, useForm } from "react-hook-form";

import CallSplitIcon from "@mui/icons-material/CallSplit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import {
  Typography,
  Box,
  Autocomplete,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Paper,
  Switch,
  IconButton,
  Collapse,
  Divider,
  Tabs,
  Tab,
} from "@mui/material";
import { isAfter, subDays } from "date-fns";

import { useConfig, useEntityListProvider } from "../../common";
import { HclItemList } from "../../common/components/HclItemList";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { IkEntity, ValidationRulesByVariable } from "../../types";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils";
import { SourceCodeVersionConfigProvider } from "../context/SourceCodeVersionConfigContext";
import {
  RefType,
  SourceCodeVersionCreate,
  SourceCodeVersionResponse,
  SourceConfigResponse,
} from "../types";

import { SourceCodeVersionConfig } from "./SourceCodeVersionConfig";

type TabValue = "metadata" | "inputs" | "outputs" | "configuration";

type GitRefRow = {
  entry: string;
  type: RefType;
  gitFolders: string[];
  sourceCodeId: string;
  entity?: SourceCodeVersionResponse;
  onVersionCreate: () => void;
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="caption"
    sx={{
      color: "text.secondary",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
    }}
  >
    {children}
  </Typography>
);

function useVersionActions(
  sourceCodeId: string,
  entity: SourceCodeVersionResponse | undefined,
  onVersionCreate: () => void,
) {
  const { ikApi } = useConfig();
  const [localInProgress, setLocalInProgress] = useState(false);

  const toggleEnabled = async () => {
    if (!entity) return;

    try {
      if (entity.status === ENTITY_STATUS.DONE) {
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.DISABLE,
        });
        notify("Version disabled successfully", "success");
      } else if (entity.status === ENTITY_STATUS.DISABLED) {
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.ENABLE,
        });
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.SYNC,
        });
        notify("Version enabled and sync task created", "success");
      }
    } catch {
      notifyError("Action failed, please try again later");
    }
  };

  const createVersion = async (
    entry: string,
    type: RefType,
    templateId: string,
    folder: string,
  ): Promise<void> => {
    setLocalInProgress(true);

    const payload: SourceCodeVersionCreate = {
      source_code_id: sourceCodeId,
      ...(type === RefType.BRANCH
        ? { source_code_branch: entry }
        : { source_code_version: entry }),
      template_id: templateId,
      source_code_folder: folder,
      description: "",
      labels: [],
    };

    try {
      const response = await ikApi.postRaw("source_code_versions", payload);
      onVersionCreate();
      await ikApi.patchRaw(`source_code_versions/${response.id}/actions`, {
        action: ENTITY_ACTION.SYNC,
      });
      notify("Version created. Sync task created.", "success");
    } catch (error) {
      notifyError(error);
      throw error;
    } finally {
      setLocalInProgress(false);
    }
  };

  const triggerSync = async () => {
    if (!entity) return;
    await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
      action: ENTITY_ACTION.SYNC,
    });
    notify("Sync task created.", "success");
  };

  return { localInProgress, toggleEnabled, createVersion, triggerSync };
}

type MetadataTabProps = {
  entity: SourceCodeVersionResponse | undefined;
  gitFolders: string[];
  entry: string;
  type: RefType;
  onVersionCreate: () => void;
  sourceCodeId: string;
  triggerSync: () => void;
};

const MetadataTab = ({
  entity,
  gitFolders,
  entry,
  type,
  onVersionCreate,
  sourceCodeId,
  triggerSync,
}: MetadataTabProps) => {
  const { ikApi } = useConfig();
  const { loading } = useEntityListProvider();
  const hasVersion = !!entity;

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [draftFolder, setDraftFolder] = useState<string>(
    entity?.source_code_folder ?? gitFolders[0],
  );
  const [draftTemplate, setDraftTemplate] = useState<string | undefined>(
    entity?.template?.id,
  );

  const { createVersion } = useVersionActions(
    sourceCodeId,
    entity,
    onVersionCreate,
  );

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (draftTemplate && draftFolder) {
      createVersion(entry, type, draftTemplate, draftFolder);
    }
  };

  return (
    <Box sx={{ pt: 0.5 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "8rem 15rem auto 8rem 15rem",
          alignItems: "center",
          mx: "1rem",
          gap: 1.5,
        }}
      >
        <FieldLabel>Template</FieldLabel>

        {hasVersion ? (
          <Typography variant="body2">{entity.template?.name}</Typography>
        ) : (
          <Box onClick={(e) => e.stopPropagation()}>
            <ReferenceInput
              ikApi={ikApi}
              entity_name="templates"
              label="Select Template"
              buffer={buffer}
              setBuffer={setBuffer}
              value={draftTemplate}
              onChange={(value: string) => setDraftTemplate(value)}
              required
            />
          </Box>
        )}

        <Box />
        <FieldLabel>Folder Path</FieldLabel>

        {hasVersion ? (
          <Typography variant="body2">
            {entity.source_code_folder ?? "—"}
          </Typography>
        ) : (
          <Box onClick={(e) => e.stopPropagation()}>
            <Autocomplete
              size="small"
              options={gitFolders}
              value={draftFolder}
              onChange={(_, newValue) => setDraftFolder(newValue ?? "")}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select or enter folder path"
                  sx={{
                    "& .MuiInputBase-input": {
                      fontSize: "0.875rem",
                    },
                  }}
                />
              )}
            />
          </Box>
        )}
      </Box>

      {!hasVersion && (
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5, mr: 2 }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={handleSave}
            disabled={!draftTemplate || !draftFolder || loading}
          >
            Save
          </Button>
        </Box>
      )}

      {entity?.status === "error" && (
        <Box
          sx={{ display: "flex", justifyContent: "flex-end", mt: 1.5, mr: 2 }}
        >
          <Button
            variant="contained"
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              triggerSync();
            }}
          >
            Sync
          </Button>
        </Box>
      )}
    </Box>
  );
};

type InputTabContentProps = {
  source_code_version: SourceCodeVersionResponse;
};

const InputTabContent = ({ source_code_version }: InputTabContentProps) => {
  const { ikApi } = useConfig();
  const [configs, setConfigs] = useState<SourceConfigResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfigs = async () => {
      if (!source_code_version?.id) {
        return;
      }

      try {
        setLoading(true);
        const configsResponse: SourceConfigResponse[] = await ikApi.get(
          `source_code_versions/${source_code_version.id}/configs`,
        );

        let validationRulesResponse: ValidationRulesByVariable[] = [];
        if (source_code_version?.template?.id) {
          try {
            validationRulesResponse = await ikApi.get(
              `validation_rules/template/${source_code_version.template.id}`,
            );
          } catch (validationError: any) {
            notifyError(validationError);
          }
        }

        const validationRulesMap = new Map<
          string,
          ValidationRulesByVariable["rules"][number]
        >();
        validationRulesResponse.forEach(({ variable_name, rules }) => {
          if (!rules || rules.length === 0) {
            return;
          }

          validationRulesMap.set(variable_name, rules[0]);
        });

        const enrichedConfigs = configsResponse.map((config) => {
          const rule = validationRulesMap.get(config.name);
          if (!rule) {
            return config;
          }

          const existingRegex =
            typeof config.validation_regex === "string"
              ? config.validation_regex
              : config.validation_regex || "";

          return {
            ...config,
            validation_rule_id: config.validation_rule_id ?? rule.id ?? null,
            validation_regex: existingRegex || rule.regex_pattern || "",
            validation_min_value:
              config.validation_min_value ?? rule.min_value ?? null,
            validation_max_value:
              config.validation_max_value ?? rule.max_value ?? null,
          };
        });

        setConfigs(enrichedConfigs);
      } catch (error: any) {
        notifyError(error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfigs();
  }, [source_code_version?.id, source_code_version?.template?.id, ikApi]);

  return (
    <Box sx={{ pt: 0.5 }}>
      {loading ? (
        <CircularProgress size={16} />
      ) : (
        <HclItemList items={configs} type="variables" />
      )}
    </Box>
  );
};

type OutputTabContentProps = {
  loading: boolean;
  children: React.ReactNode;
};

const OutputTabContent = ({ loading, children }: OutputTabContentProps) => (
  <Box sx={{ pt: 0.5 }}>
    {loading ? <CircularProgress size={16} /> : children}
  </Box>
);

type ConfigurationTabContentProps = {
  entity?: SourceCodeVersionResponse;
};

const ConfigurationTabContent = ({ entity }: ConfigurationTabContentProps) => {
  const methods = useForm();
  const { ikApi } = useConfig();

  if (!entity) return null;

  return (
    <SourceCodeVersionConfigProvider ikApi={ikApi} sourceCodeVersion={entity}>
      <FormProvider {...methods}>
        <SourceCodeVersionConfig />
      </FormProvider>
    </SourceCodeVersionConfigProvider>
  );
};

export const SourceCodeRefRow = ({
  entry,
  type,
  gitFolders,
  sourceCodeId,
  entity,
  onVersionCreate,
}: GitRefRow) => {
  const { loading } = useEntityListProvider();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("metadata");

  const { localInProgress, toggleEnabled, triggerSync } = useVersionActions(
    sourceCodeId,
    entity,
    onVersionCreate,
  );

  const hasVersion = !!entity;
  const isDone = entity?.status === ENTITY_STATUS.DONE;
  const isEntityInProgress =
    entity?.status === ENTITY_STATUS.IN_PROGRESS ||
    entity?.status === ENTITY_STATUS.READY;
  const inProgress = localInProgress || isEntityInProgress;

  const SrcIcon = type === RefType.BRANCH ? CallSplitIcon : SellOutlinedIcon;
  const accentColor = type === RefType.TAG ? "primary.main" : "warning.main";

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!hasVersion) {
      setOpen(true);
      notify(
        "Please configure template and source folder before enabling",
        "warning",
      );
      return;
    }

    toggleEnabled();
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  const isRecentlyCreated =
    hasVersion &&
    entity?.created_at &&
    isAfter(new Date(entity.created_at), subDays(new Date(), 3));

  return (
    <Paper
      variant="outlined"
      sx={{
        py: 1,
        borderLeft: 3,
        borderLeftColor: open ? accentColor : "transparent",
        transition: "border-left-color 0.15s ease",
        "&:hover": { borderLeftColor: accentColor },
      }}
    >
      <Box
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          display: "grid",
          gridTemplateColumns: "1fr auto auto auto",
          cursor: "pointer",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            px: 2,
            py: 1.25,
          }}
        >
          <SrcIcon
            fontSize="small"
            sx={{ color: "text.secondary", flexShrink: 0 }}
          />
          <Typography variant="body2" sx={{ fontSize: "0.82rem" }}>
            {entry}
          </Typography>
          {/* TO DO
          {(!hasVersion || isRecentlyCreated) && (
            <Chip
              label="New"
              size="small"
              color="info"
              sx={{
                height: 20,
                fontSize: "0.7rem",
                "& .MuiChip-label": { px: 0.75 },
              }}
            />
          )} */}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          {loading || inProgress ? (
            <CircularProgress size={20} sx={{ mx: 2.5 }} />
          ) : (
            <Switch checked={isDone} onClick={handleToggle} sx={{ pl: 2 }} />
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", px: 1 }}>
          <IconButton
            size="small"
            disabled={inProgress || loading}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
            sx={{
              "& svg": {
                transition: "transform 0.2s",
                transform: open ? "rotate(180deg)" : "rotate(0deg)",
              },
            }}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Divider />
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{ borderBottom: 1, borderColor: "divider", mb: 1.5 }}
          >
            <Tab label="Metadata" value="metadata" />
            <Tab
              label={`Inputs (${entity?.variables?.length ?? 0})`}
              value="inputs"
              disabled={!hasVersion}
            />
            <Tab
              label={`Outputs (${entity?.outputs?.length ?? 0})`}
              value="outputs"
              disabled={!hasVersion}
            />
            <Tab label="Configure" value="configuration" disabled={!isDone} />
          </Tabs>

          {activeTab === "metadata" && (
            <MetadataTab
              entity={entity}
              gitFolders={gitFolders}
              entry={entry}
              type={type}
              sourceCodeId={sourceCodeId}
              onVersionCreate={onVersionCreate}
              triggerSync={triggerSync}
            />
          )}

          {activeTab === "inputs" && entity && (
            <InputTabContent source_code_version={entity} />
          )}

          {activeTab === "outputs" && (
            <OutputTabContent loading={loading}>
              <HclItemList items={entity?.outputs} type="outputs" />
            </OutputTabContent>
          )}

          {activeTab === "configuration" && (
            <ConfigurationTabContent entity={entity} />
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
