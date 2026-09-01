import { useCallback } from "react";

import { MenuItem, TextField } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
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
        name={"Source Code"}
        value={<GetReferenceUrlValue {...source_code_version.sourceCode} />}
      />
      <CommonField
        name={"Source Code Directory"}
        value={getTextValue(
          source_code_version.sourceCodeFolder
            ? source_code_version.sourceCodeFolder
            : "No Source Code Folder",
        )}
      />
      <CommonField
        name={"Branch"}
        value={getTextValue(
          source_code_version.sourceCodeBranch
            ? source_code_version.sourceCodeBranch
            : "No Branch",
        )}
      />
      <CommonField
        name={"Source Code Tag"}
        value={getTextValue(
          source_code_version.sourceCodeVersion
            ? source_code_version.sourceCodeVersion
            : "No Version",
        )}
      />
      <CommonEditableField<string>
        name={"Breaking Changes"}
        canEdit={canEdit}
        value={source_code_version.breakingChanges ?? ""}
        ariaLabel="Edit breaking changes"
        display={
          <span>
            {source_code_version.breakingChanges || "No breaking changes"}
          </span>
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
            label="Lifecycle State"
            fullWidth
            margin="normal"
            autoFocus
          >
            {Object.values(VERSION_LIFECYCLE_STATE).map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={source_code_version.createdAt}
            user={source_code_version.creator}
          />
        }
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
