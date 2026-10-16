import { ReactNode, useCallback } from "react";

import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { Box, Grid, MenuItem, TextField } from "@mui/material";

import { Entity } from "../../common";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { CodeRepository } from "../../common/components/entities/CodeRepository";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { VERSION_LIFECYCLE_STATE } from "../../utils/constants";
import { GqlSourceCodeVersion } from "../graphql";
import {
  SourceCodeVersionUpdateFieldInput,
  UPDATE_SOURCE_CODE_VERSION_MUTATION,
} from "../graphql/mutations";

export interface SourceCodeVersionSidebarProps {
  source_code_version: GqlSourceCodeVersion;
}

/** Git ref / path value rendered as inline code next to its icon. */
const codeValue = (icon: ReactNode, value?: string | null) =>
  value ? (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
      {icon}
      <InlineCode>{value}</InlineCode>
    </Box>
  ) : null;

/**
 * GitHub-style right sidebar for the template version detail page: groups the
 * version's description, lifecycle, template, code source and history so the
 * main column can focus on inputs, outputs and code.
 */
export const SourceCodeVersionSidebar = ({
  source_code_version,
}: SourceCodeVersionSidebarProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:source_code_version", "write");
  const lifecycleState =
    source_code_version.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN;

  const saveField = useCallback(
    async (input: SourceCodeVersionUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_SOURCE_CODE_VERSION_MUTATION, {
          id: source_code_version.id,
          input,
        });
        notify("Source code version updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, source_code_version.id, refreshEntity],
  );

  return (
    <EntitySidebar ariaLabel="Template version details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={source_code_version.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={source_code_version.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={source_code_version.status} />
        </Grid>
        <CommonEditableField<string>
          name="Lifecycle State"
          canEdit={canEdit}
          value={source_code_version.lifecycleState ?? "unknown"}
          ariaLabel="Edit lifecycle state"
          display={
            <VersionLifecycleStateChip
              lifecycleState={lifecycleState}
              breakingChanges={source_code_version.breakingChanges ?? undefined}
            />
          }
          onSave={(value) =>
            saveField({ lifecycleState: value.toLocaleUpperCase() })
          }
          renderEditor={({ value, onChange }) => (
            <TextField
              select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              slotProps={{ input: { "aria-label": "Lifecycle State" } }}
              fullWidth
              margin="normal"
              autoFocus
            >
              {Object.values(VERSION_LIFECYCLE_STATE).map((option) => (
                <MenuItem key={option} value={option}>
                  <VersionLifecycleStateChip lifecycleState={option} />
                </MenuItem>
              ))}
            </TextField>
          )}
          size={12}
        />
        <CommonEditableField<string>
          name="Breaking Changes"
          canEdit={canEdit}
          value={source_code_version.breakingChanges ?? ""}
          ariaLabel="Edit breaking changes"
          display={
            source_code_version.breakingChanges ? (
              <span>{source_code_version.breakingChanges}</span>
            ) : null
          }
          onSave={(value) => saveField({ breakingChanges: value })}
          renderEditor={({ value, onChange }) => (
            <TextField
              value={value}
              onChange={(e) => onChange(e.target.value)}
              slotProps={{ input: { "aria-label": "Breaking Changes" } }}
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Template">
        <CommonField
          name="Template"
          value={
            source_code_version.template ? (
              <GetReferenceUrlValue {...source_code_version.template} />
            ) : null
          }
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Source">
        <CommonField
          name="Code Repository"
          value={
            source_code_version.sourceCode ? (
              <CodeRepository
                id={source_code_version.sourceCode.id}
                entityName={source_code_version.sourceCode.entityName}
                sourceCodeUrl={source_code_version.sourceCode.sourceCodeUrl}
                sourceCodeProvider={
                  source_code_version.sourceCode.sourceCodeProvider
                }
              />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Directory"
          value={codeValue(
            <FolderOutlinedIcon fontSize="small" color="action" />,
            source_code_version.sourceCodeFolder,
          )}
          size={12}
        />
        <CommonField
          name="Branch"
          value={codeValue(
            <CallSplitOutlinedIcon fontSize="small" color="action" />,
            source_code_version.sourceCodeBranch,
          )}
          size={6}
        />
        <CommonField
          name="Tag"
          value={codeValue(
            <LocalOfferOutlinedIcon fontSize="small" color="action" />,
            source_code_version.sourceCodeVersion,
          )}
          size={6}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            source_code_version.creator ? (
              <Entity
                entity={{ ...source_code_version.creator, entityType: "user" }}
              />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={source_code_version.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={source_code_version.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={source_code_version.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
