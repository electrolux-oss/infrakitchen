import { useState } from "react";
import React from "react";

import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";

import {
  useConfig,
  useEntityListProvider,
  CommonDialog,
  usePermissionProvider,
} from "../../common";
import { Audit } from "../../common/components/activity/Audit";
import { HclItemList } from "../../common/components/hcl/HclItemList";
import { notify } from "../../common/hooks/useNotification";
import {
  CallSplitIcon,
  KeyboardArrowDownIcon,
  SellOutlinedIcon,
} from "../../icons/material";
import { Revision } from "../../revision/Revision";
import {
  Divider,
  Spinner,
  Switch,
  IconButton,
  Button,
  Chip,
  Tabs,
  Tab,
  Collapse,
} from "../../ui";
import { ENTITY_STATUS } from "../../utils";
import { cn } from "../../utils/cn";
import { SourceCodeVersionConfigProvider } from "../context/SourceCodeVersionConfigContext";
import { GqlSourceCodeVersion } from "../graphql";
import { useVersionActions } from "../hooks/useVersionActions";
import { RefType } from "../types";

import { InputTab } from "./InputTab";
import { MetadataTab } from "./MetadataTab";
import { SourceCodeVersionConfig } from "./SourceCodeVersionConfig";

type TabValue =
  "metadata" | "inputs" | "outputs" | "configuration" | "audit" | "revision";

type GitRefRow = {
  entry: string;
  type: RefType;
  gitFolders: string[];
  sourceCodeId: string;
  entity?: GqlSourceCodeVersion;
  defaultOpen?: boolean;
  defaultTab?: TabValue;
  onRefresh: () => void;
};

type ConfigurationTabContentProps = {
  entity?: GqlSourceCodeVersion;
};

export const ConfigurationTabContent = ({
  entity,
}: ConfigurationTabContentProps) => {
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
  defaultTab = "metadata",
  onRefresh,
}: GitRefRow) => {
  const { loading } = useEntityListProvider();
  const { linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();

  const [open, setOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<TabValue>(defaultTab);
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);

  const canWrite = checkActionPermission("api:source_code_version", "write");

  const { localInProgress, toggleEnabled, triggerSync } = useVersionActions(
    sourceCodeId,
    entity,
    onRefresh,
  );

  const hasVersion = !!entity;
  const isDone = entity?.status.toLocaleLowerCase() === ENTITY_STATUS.DONE;
  const isEntityInProgress =
    entity?.status === ENTITY_STATUS.IN_PROGRESS ||
    entity?.status === ENTITY_STATUS.READY;
  const inProgress = localInProgress || isEntityInProgress;

  const SrcIcon = type === RefType.BRANCH ? CallSplitIcon : SellOutlinedIcon;
  const isTag = type === RefType.TAG;
  const accentClass = isTag ? "border-l-primary" : "border-l-warning";
  const accentHoverClass = isTag
    ? "hover:border-l-primary"
    : "hover:border-l-warning";

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
    <div
      className={cn(
        "rounded-surface border border-divider bg-paper text-fg",
        "border-l-3 py-2 [transition:border-left-color_0.15s_ease]",
        open ? accentClass : "border-l-transparent",
        accentHoverClass,
      )}
    >
      <div
        className="grid cursor-pointer grid-cols-[1fr_auto_auto_auto]"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <SrcIcon className="shrink-0 text-fg-muted" fontSize="small" />
          <p className="m-0 text-[0.82rem] font-normal">{entry}</p>
          {hasVersion &&
            !!entity.resourcesCount && ( // Render only when the SCV has resources
              <Chip
                className="h-5 text-[0.7rem] hover:border-primary hover:text-primary"
                labelClassName="px-1.5"
                label={`${entity.resourcesCount}`}
                variant="outlined"
                onClick={handleResourcesClick}
              />
            )}
        </div>

        <div className="flex items-center pr-3">
          {loading || inProgress ? (
            <Spinner className="mx-5" size={20} />
          ) : (
            <Switch
              checked={isDone}
              onClick={handleToggle}
              disabled={!canWrite}
            />
          )}
        </div>

        <div className="flex items-center px-2">
          <IconButton
            className={cn(
              "[&_svg]:transition-transform [&_svg]:duration-200",
              open && "[&_svg]:rotate-180",
            )}
            size="small"
            disabled={inProgress || loading}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((prev) => !prev);
            }}
          >
            <KeyboardArrowDownIcon fontSize="small" />
          </IconButton>
        </div>
      </div>
      <CommonDialog
        open={toggleDialogOpen}
        onClose={() => setToggleDialogOpen(false)}
        title={isDone ? "Disable Version" : "Enable Version"}
        content={
          <p className="m-0 text-body2">
            Are you sure you want to {isDone ? "disable" : "enable"} this
            version ({entry})?
          </p>
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
        <div className="px-4 pb-3">
          <Tabs
            className="mb-3 border-b border-divider"
            value={activeTab}
            onChange={handleTabChange}
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
            <div className="pt-1">
              {loading ? (
                <Spinner size={16} />
              ) : (
                <>
                  {entity?.outputs ? (
                    <HclItemList items={entity?.outputs} type="outputs" />
                  ) : (
                    "No outputs defined."
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === "audit" && entity && (
            <Audit
              entityId={entity.id}
              useVersionId
              sourceCodeLanguage={entity?.sourceCode?.sourceCodeLanguage}
              showRevisionColumn
            />
          )}

          {activeTab === "revision" && entity && (
            <div className="max-w-250">
              <Revision resourceId={entity.id} resourceRevision={0} />
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};
