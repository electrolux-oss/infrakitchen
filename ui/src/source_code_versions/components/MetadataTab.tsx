import { useState } from "react";
import React from "react";

import { useNavigate } from "react-router";

import {
  useConfig,
  useEntityListProvider,
  CommonDialog,
  InlineCode,
  PermissionWrapper,
} from "../../common";
import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { HeroArrowTopRightOnSquareIcon } from "../../icons";
import { IkEntity } from "../../types";
import { Autocomplete, Button, IconButton, Tooltip } from "../../ui";
import { ENTITY_STATUS } from "../../utils";
import { GqlSourceCodeVersion } from "../graphql";
import { useVersionActions } from "../hooks/useVersionActions";
import { RefType } from "../types";

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-caption tracking-[0.05em] text-fg-muted uppercase">
    {children}
  </span>
);

type MetadataTabProps = {
  entity: GqlSourceCodeVersion | undefined;
  gitFolders: string[];
  entry: string;
  type: RefType;
  onRefresh: () => void;
  sourceCodeId: string;
  triggerSync: () => void;
};

export const MetadataTab = ({
  entity,
  gitFolders,
  entry,
  type,
  onRefresh,
  sourceCodeId,
  triggerSync,
}: MetadataTabProps) => {
  const { ikApi, linkPrefix } = useConfig();
  const { loading } = useEntityListProvider();
  const navigate = useNavigate();
  const hasVersion = !!entity;

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );
  const [draftFolder, setDraftFolder] = useState<string>(
    entity?.sourceCodeFolder ?? gitFolders[0],
  );
  const [draftTemplate, setDraftTemplate] = useState<string | undefined>(
    entity?.template?.id,
  );

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rootPathDialogOpen, setRootPathDialogOpen] = useState(false);

  const { createVersion } = useVersionActions(sourceCodeId, entity, onRefresh);

  const saveVersion = () => {
    if (draftTemplate && draftFolder) {
      createVersion(entry, type, draftTemplate, draftFolder);
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (draftFolder === "/") {
      setRootPathDialogOpen(true);
      return;
    }

    saveVersion();
  };

  return (
    <div className="pt-1">
      <div className="mx-[1rem] grid grid-cols-[8rem_15rem_auto_8rem_15rem] items-center gap-3">
        <FieldLabel>Template</FieldLabel>

        {hasVersion ? (
          <p className="m-0 text-body2">{entity.template?.name}</p>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
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
          </div>
        )}

        <div />
        <FieldLabel>Path</FieldLabel>

        {hasVersion ? (
          <p className="m-0 text-body2">{entity.sourceCodeFolder ?? "—"}</p>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            <Autocomplete
              options={gitFolders}
              value={draftFolder}
              onChange={(_, newValue) => setDraftFolder(newValue ?? "")}
              placeholder="Select or enter path"
            />
          </div>
        )}
      </div>

      <div className="mt-3 mr-4 flex justify-end gap-2">
        <PermissionWrapper
          requiredPermission="api:source_code_version"
          permissionAction="write"
        >
          {!hasVersion && (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!draftTemplate || !draftFolder || loading}
            >
              Save
            </Button>
          )}
          <CommonDialog
            open={rootPathDialogOpen}
            onClose={() => setRootPathDialogOpen(false)}
            title="Save root path?"
            content={
              <p className="m-0 text-body2">
                The selected path is <InlineCode>/</InlineCode>. This will save
                the version at the repository root. Do you want to continue?
              </p>
            }
            actions={
              <Button
                variant="contained"
                onClick={() => {
                  saveVersion();
                  setRootPathDialogOpen(false);
                }}
              >
                Save Anyway
              </Button>
            }
          />
        </PermissionWrapper>

        {entity?.status === "error" && (
          <Button
            variant="contained"
            onClick={(e) => {
              e.stopPropagation();
              triggerSync();
            }}
          >
            Sync
          </Button>
        )}

        {hasVersion && (
          <>
            <Tooltip title="Open version detail page">
              <IconButton
                className="justify-self-start"
                size="small"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey) {
                    window.open(
                      `${linkPrefix}source_code_versions/${entity.id}`,
                      "_blank",
                    );
                    return;
                  }
                  navigate(`${linkPrefix}source_code_versions/${entity.id}`);
                }}
              >
                <HeroArrowTopRightOnSquareIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <PermissionWrapper
              requiredPermission="api:source_code_version"
              permissionAction="write"
            >
              <Tooltip title={"Configure template references"}>
                <span>
                  <Button
                    color="error"
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey) {
                        window.open(
                          `${linkPrefix}source_code_versions/${entity.id}/configuration`,
                          "_blank",
                        );
                        return;
                      }
                      navigate(
                        `${linkPrefix}source_code_versions/${entity.id}/configuration`,
                      );
                    }}
                  >
                    Configure
                  </Button>
                </span>
              </Tooltip>

              <Tooltip
                title={
                  entity.status !== ENTITY_STATUS.DISABLED
                    ? "Version must be disabled before erasing data"
                    : (entity.resourcesCount || 0) > 0
                      ? "Version has active resources and cannot be erased"
                      : ""
                }
              >
                <span>
                  <Button
                    color="error"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={
                      entity.status !== ENTITY_STATUS.DISABLED ||
                      (entity.resourcesCount || 0) > 0
                    }
                  >
                    Erase Data
                  </Button>
                </span>
              </Tooltip>
              <CommonDialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                title="Erase Version Data"
                content={
                  <p className="m-0 text-body2">
                    Are you sure you want to erase all data for this version?
                    This action is irreversible.
                  </p>
                }
                actions={
                  <DeleteButton
                    entity_id={entity.id}
                    entity_name="source_code_version"
                    ikApi={ikApi}
                    onDelete={() => {
                      onRefresh();
                      setDeleteDialogOpen(false);
                    }}
                  >
                    Erase
                  </DeleteButton>
                }
              />
            </PermissionWrapper>
          </>
        )}
      </div>
    </div>
  );
};
