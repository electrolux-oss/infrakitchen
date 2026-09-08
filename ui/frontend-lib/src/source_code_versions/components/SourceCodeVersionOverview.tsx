import { useCallback } from "react";

import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { Box, MenuItem, TextField } from "@mui/material";

import { CodeRepository } from "../../common/components/entities/CodeRepository";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { InlineCode } from "../../common/components/code/InlineCode";
import { OverviewCard } from "../../common/components/cards/OverviewCard";
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

export interface SourceCodeVersionAboutProps {
  source_code_version: GqlSourceCodeVersion;
}

export const SourceCodeVersionOverview = ({
  source_code_version,
}: SourceCodeVersionAboutProps) => {
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
    <OverviewCard name={source_code_version.identifier}>
      <CommonField
        name={"Template"}
        value={<GetReferenceUrlValue {...source_code_version.template} />}
      />
      <CommonField
        name={"State"}
        value={<StatusChip status={source_code_version.status} />}
      />
      <CommonField
        name={"Code Repository"}
        value={
          <CodeRepository
            id={source_code_version.sourceCode?.id}
            entityName={source_code_version.sourceCode?.entityName}
            sourceCodeUrl={source_code_version.sourceCode?.sourceCodeUrl}
            sourceCodeProvider={
              source_code_version.sourceCode?.sourceCodeProvider
            }
          />
        }
      />
      <CommonField
        name={"Directory"}
        value={
          source_code_version.sourceCodeFolder ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <FolderOutlinedIcon fontSize="small" color="action" />
              <InlineCode>{source_code_version.sourceCodeFolder}</InlineCode>
            </Box>
          ) : (
            source_code_version.sourceCodeFolder
          )
        }
      />
      <CommonField
        name={"Branch"}
        value={
          source_code_version.sourceCodeBranch ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <CallSplitOutlinedIcon fontSize="small" color="action" />
              <InlineCode>{source_code_version.sourceCodeBranch}</InlineCode>
            </Box>
          ) : (
            source_code_version.sourceCodeBranch
          )
        }
      />
      <CommonField
        name={"Tag"}
        value={
          source_code_version.sourceCodeVersion ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <LocalOfferOutlinedIcon fontSize="small" color="action" />
              <InlineCode>{source_code_version.sourceCodeVersion}</InlineCode>
            </Box>
          ) : (
            source_code_version.sourceCodeVersion
          )
        }
      />
      <CommonEditableField<string>
        name={"Breaking Changes"}
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
      <CommonEditableField<string>
        name={"Lifecycle State"}
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
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={source_code_version.createdAt} />}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={source_code_version.updatedAt} />}
      />{" "}
      <EditableDescriptionField
        value={source_code_version.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />{" "}
      <EditableTagsField
        value={source_code_version.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
    </OverviewCard>
  );
};
