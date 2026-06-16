import { useCallback, useState } from "react";

import { Box, TextField } from "@mui/material";

import { IconField } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
  getRemoteUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl, sameStringSet } from "../../common/utils";
import { IkEntity } from "../../types";
import {
  SourceCodeUpdateFieldInput,
  UPDATE_SOURCE_CODE_MUTATION,
} from "../graphql/mutations";
import { SourceCodeResponse } from "../types";

export interface SourceCodeOverviewProps {
  sourceCode: SourceCodeResponse;
}

export const SourceCodeOverview = ({ sourceCode }: SourceCodeOverviewProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:source_code", "write");

  const [buffer, setBuffer] = useState<Record<string, IkEntity | IkEntity[]>>(
    {},
  );

  const saveField = useCallback(
    async (input: SourceCodeUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(UPDATE_SOURCE_CODE_MUTATION, {
          id: sourceCode.id,
          input,
        });
        notify("Source code updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, sourceCode.id, refreshEntity],
  );

  return (
    <OverviewCard
      name={getRepoNameFromUrl(sourceCode.sourceCodeUrl)}
      description={sourceCode.description}
    >
      <CommonField
        name={"URL"}
        value={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {IconField(sourceCode.sourceCodeProvider)}
            {getRemoteUrlValue(sourceCode.sourceCodeUrl)}
          </Box>
        }
      />
      <CommonField
        name={"Type"}
        value={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {IconField(sourceCode.sourceCodeLanguage)}
            {sourceCode.sourceCodeLanguage}
          </Box>
        }
      />
      <CommonField
        name={"Status"}
        value={<StatusChip status={sourceCode.status} />}
      />
      <CommonEditableField<string | null>
        name={"Integration"}
        canEdit={canEdit}
        value={sourceCode.integration ? sourceCode.integration.id : null}
        ariaLabel="Edit integration"
        display={
          sourceCode.integration ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {IconField(sourceCode.sourceCodeProvider)}
              <GetReferenceUrlValue
                {...sourceCode.integration}
                urlProvider={sourceCode.integration.integration_provider}
              />
            </Box>
          ) : null
        }
        onSave={(value) => saveField({ integrationId: value })}
        renderEditor={({ value, onChange }) => (
          <ReferenceInput
            ikApi={ikApi}
            buffer={buffer}
            setBuffer={setBuffer}
            entity_name="integrations"
            filter={{ integration_type: "git" }}
            value={value}
            onChange={onChange}
            label="Select Integration"
            helpertext="Select credentials for the source code"
          />
        )}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={sourceCode.createdAt} user={sourceCode.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={sourceCode.updatedAt} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={sourceCode.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{sourceCode.description || "No description"}</span>}
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
        value={sourceCode.labels}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={sourceCode.labels} />}
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
