import { useState } from "react";
import React from "react";

import { useNavigate } from "react-router";

import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import {
  Typography,
  Box,
  Autocomplete,
  TextField,
  Button,
  Tooltip,
  IconButton,
} from "@mui/material";

import {
  useConfig,
  useEntityListProvider,
  CommonDialog,
  PermissionWrapper,
} from "../../common";
import { DeleteButton } from "../../common/components/buttons/DeleteEntityButton";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { IkEntity } from "../../types";
import { ENTITY_STATUS } from "../../utils";
import { GqlSourceCodeVersion } from "../graphql";
import { useVersionActions } from "../hooks/useVersionActions";
import { RefType } from "../types";

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
        <FieldLabel>Path</FieldLabel>

        {hasVersion ? (
          <Typography variant="body2">
            {entity.sourceCodeFolder ?? "—"}
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
                  placeholder="Select or enter path"
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

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 1.5,
          mr: 2,
          gap: 1,
        }}
      >
        <PermissionWrapper
          requiredPermission="api:source_code_version"
          permissionAction="write"
        >
          {!hasVersion && (
            <Button
              variant="contained"
              size="small"
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
              <Typography variant="body2">
                The selected path is <code>/</code>. This will save the version
                at the repository root. Do you want to continue?
              </Typography>
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
            size="small"
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
                sx={{ justifySelf: "start" }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <PermissionWrapper
              requiredPermission="api:source_code_version"
              permissionAction="write"
            >
              <Tooltip title={"Configure template references"}>
                <span>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
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
                    variant="outlined"
                    color="error"
                    size="small"
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
                  <Typography variant="body2">
                    Are you sure you want to erase all data for this version?
                    This action is irreversible.
                  </Typography>
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
      </Box>
    </Box>
  );
};
