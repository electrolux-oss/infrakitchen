import { useCallback } from "react";

import { TextField } from "@mui/material";

import { Labels } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import {
  SourceCodeVersionUpdateFieldInput,
  UPDATE_SOURCE_CODE_VERSION_MUTATION,
} from "../graphql/mutations";
import { SourceCodeVersionResponse } from "../types";

const sameStringSet = (a: string[], b: string[]) =>
  a.length === b.length &&
  [...a].sort().join("\u0000") === [...b].sort().join("\u0000");

export interface SourceCodeVersionAboutProps {
  source_code_version: SourceCodeVersionResponse;
}

export const SourceCodeVersionOverview = ({
  source_code_version,
}: SourceCodeVersionAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:source_code_version", "write");

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
    <OverviewCard
      name={source_code_version.identifier}
      description={source_code_version.description || "No description"}
    >
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
        value={<GetReferenceUrlValue {...source_code_version.source_code} />}
      />
      <CommonField
        name={"Source Code Directory"}
        value={getTextValue(
          source_code_version.source_code_folder
            ? source_code_version.source_code_folder
            : "No Source Code Folder",
        )}
      />
      <CommonField
        name={"Branch"}
        value={getTextValue(
          source_code_version.source_code_branch
            ? source_code_version.source_code_branch
            : "No Branch",
        )}
      />
      <CommonField
        name={"Source Code Tag"}
        value={getTextValue(
          source_code_version.source_code_version
            ? source_code_version.source_code_version
            : "No Version",
        )}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime
            date={source_code_version.created_at}
            user={source_code_version.creator}
          />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={source_code_version.updated_at} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={source_code_version.description ?? ""}
        ariaLabel="Edit description"
        display={
          <span>{source_code_version.description || "No description"}</span>
        }
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            margin="normal"
            autoFocus
          />
        )}
        size={12}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={source_code_version.labels}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={source_code_version.labels} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />
    </OverviewCard>
  );
};
