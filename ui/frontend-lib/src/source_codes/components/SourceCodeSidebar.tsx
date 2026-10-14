import { useCallback, useState } from "react";

import { Box, Grid } from "@mui/material";

import { Entity, IconField } from "../../common";
import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getRemoteUrlValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import ReferenceInput from "../../common/components/inputs/ReferenceInput";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { IkEntity } from "../../types";
import { GqlSourceCode } from "../graphql";
import {
  SourceCodeUpdateFieldInput,
  UPDATE_SOURCE_CODE_MUTATION,
} from "../graphql/mutations";

export interface SourceCodeSidebarProps {
  sourceCode: GqlSourceCode;
}

/**
 * GitHub-style right sidebar for the code repository detail page: groups the
 * repository's description, status, remote and history so the main column can
 * focus on its commits, tags and branches.
 */
export const SourceCodeSidebar = ({ sourceCode }: SourceCodeSidebarProps) => {
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
    <EntitySidebar ariaLabel="Code repository details">
      <SidebarSection title="About">
        <EditableDescriptionField
          value={sourceCode.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <EditableTagsField
          value={sourceCode.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Status">
        <Grid size={12}>
          <StatusChip status={sourceCode.status} />
        </Grid>
      </SidebarSection>

      <SidebarSection title="Repository">
        <CommonField
          name={"URL"}
          value={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {IconField(sourceCode.sourceCodeProvider)}
              {getRemoteUrlValue(sourceCode.sourceCodeUrl)}
            </Box>
          }
          size={12}
        />
        <CommonField
          name={"Type"}
          value={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {IconField(sourceCode.sourceCodeLanguage)}
              {sourceCode.sourceCodeLanguage}
            </Box>
          }
          size={12}
        />
        <CommonField
          name={"Default Branch"}
          value={
            sourceCode.defaultBranch ? (
              sourceCode.defaultBranch
            ) : (
              <PlaceholderText text="Not synced" />
            )
          }
          size={12}
        />
        <CommonEditableField<string | null>
          name={"Integration"}
          canEdit={canEdit}
          value={sourceCode.integration ? sourceCode.integration.id : null}
          ariaLabel="Edit integration"
          display={
            sourceCode.integration ? (
              <Entity entity={sourceCode.integration} providerIconSize={24} />
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
          size={12}
        />
      </SidebarSection>

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            sourceCode.creator ? (
              <Entity entity={{ ...sourceCode.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={sourceCode.createdAt} />}
          size={6}
        />
        <CommonField
          name="Last Updated"
          value={<RelativeTime date={sourceCode.updatedAt} />}
          size={6}
        />
        <CommonField
          name="Revision"
          value={sourceCode.revisionNumber}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
