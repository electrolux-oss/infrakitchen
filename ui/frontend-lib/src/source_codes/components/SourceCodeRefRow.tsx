import { useState } from "react";
import React from "react";

import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import CallSplitIcon from "@mui/icons-material/CallSplit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import SellOutlinedIcon from "@mui/icons-material/SellOutlined";
import {
  Typography,
  Box,
  CircularProgress,
  Paper,
  Switch,
  IconButton,
  Collapse,
  Divider,
  Tabs,
  Tab,
  Chip,
  Button,
} from "@mui/material";

import {
  useConfig,
  useEntityListProvider,
  CommonDialog,
  usePermissionProvider,
} from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { Revision } from "../../common/components/activity/Revision";
import { HclItemList } from "../../common/components/HclItemList";
import { notify } from "../../common/hooks/useNotification";
import { ENTITY_STATUS } from "../../utils";
import { SourceCodeVersionConfigProvider } from "../context/SourceCodeVersionConfigContext";
import { useVersionActions } from "../hooks/useVersionActions";
import { RefType, SourceCodeVersionResponse } from "../types";

import { InputTab } from "./InputTab";
import { MetadataTab } from "./MetadataTab";
import { SourceCodeVersionConfig } from "./SourceCodeVersionConfig";

type TabValue =
  | "metadata"
  | "inputs"
  | "outputs"
  | "configuration"
  | "audit"
  | "revision";

type GitRefRow = {
  entry: string;
  type: RefType;
  gitFolders: string[];
  sourceCodeId: string;
  entity?: SourceCodeVersionResponse;
  defaultOpen?: boolean;
  onRefresh: () => void;
};

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
  defaultOpen = false,
  onRefresh,
}: GitRefRow) => {
  const { loading } = useEntityListProvider();
  const { linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();

  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabValue>("metadata");
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);

  const canWrite = checkActionPermission("api:source_code_version", "write");

  const { localInProgress, toggleEnabled, triggerSync } = useVersionActions(
    sourceCodeId,
    entity,
    onRefresh,
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

    if (!canWrite) return;

    if (!hasVersion) {
      setOpen(true);
      notify(
        "Please configure template and source folder before enabling",
        "warning",
      );
      return;
    }

    setToggleDialogOpen(true);
  };

  const handleConfirmToggle = () => {
    toggleEnabled();
    setToggleDialogOpen(false);
  };

  const handleTabChange = (_: React.SyntheticEvent, newValue: TabValue) => {
    setActiveTab(newValue);
  };

  const handleResourcesClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (entity) {
      const filterValue = [
        `template:${entity.template.id}`,
        `scv:${entity.id}:${entity.template.id}`,
      ];
      navigate(`${linkPrefix}resources`, {
        state: {
          filters: {
            template_version: filterValue,
          },
        },
      });
    }
  };

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
          {hasVersion && !!entity.resource_count && (
            <Chip
              label={`${entity.resource_count}`}
              size="small"
              variant="outlined"
              onClick={handleResourcesClick}
              sx={{
                height: 20,
                fontSize: "0.7rem",
                cursor: "pointer",
                "& .MuiChip-label": { px: 0.75 },
                "&:hover": {
                  borderColor: "primary.main",
                  color: "primary.main",
                },
              }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          {loading || inProgress ? (
            <CircularProgress size={20} sx={{ mx: 2.5 }} />
          ) : (
            <Switch
              checked={isDone}
              onClick={handleToggle}
              sx={{ pl: 2 }}
              disabled={!canWrite}
            />
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

      <CommonDialog
        open={toggleDialogOpen}
        onClose={() => setToggleDialogOpen(false)}
        title={isDone ? "Disable Version" : "Enable Version"}
        content={
          <Typography variant="body2">
            Are you sure you want to {isDone ? "disable" : "enable"} this
            version ({entry})?
          </Typography>
        }
        actions={
          <Button
            variant="contained"
            color={isDone ? "error" : "primary"}
            onClick={handleConfirmToggle}
          >
            {isDone ? "Disable" : "Enable"}
          </Button>
        }
      />

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
            <Tab label="Audit" value="audit" />
            <Tab label="Revision" value="revision" />
          </Tabs>

          {activeTab === "metadata" && (
            <MetadataTab
              entity={entity}
              gitFolders={gitFolders}
              entry={entry}
              type={type}
              sourceCodeId={sourceCodeId}
              onRefresh={onRefresh}
              triggerSync={triggerSync}
            />
          )}

          {activeTab === "inputs" && entity && (
            <InputTab source_code_version={entity} />
          )}

          {activeTab === "outputs" && (
            <Box sx={{ pt: 0.5 }}>
              {loading ? (
                <CircularProgress size={16} />
              ) : (
                <HclItemList items={entity?.outputs} type="outputs" />
              )}
            </Box>
          )}

          {activeTab === "configuration" && (
            <ConfigurationTabContent entity={entity} />
          )}

          {activeTab === "audit" && entity && <Audit entityId={entity.id} />}

          {activeTab === "revision" && entity && (
            <Box sx={{ maxWidth: 1000 }}>
              <Revision resourceId={entity.id} resourceRevision={0} />
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};
