import { useCallback, useState } from "react";

import { Box } from "@mui/material";

import { IconField } from "../../common";
import {
  CommonField,
  GetReferenceUrlValue,
  getRemoteUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { getRepoNameFromUrl } from "../../common/utils";
import { IkEntity } from "../../types";
import { GqlSourceCode } from "../graphql";
import {
  SourceCodeUpdateFieldInput,
  UPDATE_SOURCE_CODE_MUTATION,
} from "../graphql/mutations";

export interface SourceCodeOverviewProps {
  sourceCode: GqlSourceCode;
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
    <OverviewCard name={getRepoNameFromUrl(sourceCode.sourceCodeUrl)}>
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
                urlProvider={sourceCode.integration.integrationProvider}
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
            ariaLabel="Integration"
            placeholder="Select integration…"
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
      />{" "}
      <EditableDescriptionField
        value={sourceCode.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />{" "}
      <EditableTagsField
        value={sourceCode.labels || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ labels: value })}
      />
    </OverviewCard>
  );
};
