import { ReactNode } from "react";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import { CodeRepository } from "../../common/components/entities/CodeRepository";
import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/fields/CommonField";
import { StatusLabel } from "../../common/components/labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import VersionLifecycleStateChip from "../../common/VersionLifecycleStateChip";
import { HeroFolderIcon, HeroShareIcon, HeroTagIcon } from "../../icons";
import { MenuItem, TextField } from "../../ui";
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
    <div className="flex min-w-0 items-center gap-1">
      {icon}
      <InlineCode>{value}</InlineCode>
    </div>
  ) : null;

/**
 * Right context sidebar for the template version detail page: groups the
 * version's description, lifecycle, template, code source and history so the
 * main column can focus on inputs, outputs and code.
 */
export const SourceCodeVersionSidebar = ({
  source_code_version,
}: SourceCodeVersionSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:source_code_version", "write");
  const lifecycleState =
    source_code_version.lifecycleState || VERSION_LIFECYCLE_STATE.UNKNOWN;

  const saveField = useEntityFieldSaver<SourceCodeVersionUpdateFieldInput>(
    UPDATE_SOURCE_CODE_VERSION_MUTATION,
    source_code_version.id,
    "Source code version",
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
        <div className="col-span-full">
          <StatusLabel status={source_code_version.status} />
        </div>
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
              aria-label="Lifecycle State"
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
          span="full"
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
              aria-label="Breaking Changes"
              fullWidth
              margin="normal"
              autoFocus
            />
          )}
          span="full"
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
          span="full"
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
          span="full"
        />
        <CommonField
          name="Directory"
          value={codeValue(
            <HeroFolderIcon
              fontSize="small"
              color="action"
              className="text-base"
            />,
            source_code_version.sourceCodeFolder,
          )}
          span="full"
        />
        <CommonField
          name="Branch"
          value={codeValue(
            <HeroShareIcon
              fontSize="small"
              color="action"
              className="text-base"
            />,
            source_code_version.sourceCodeBranch,
          )}
          span="half"
        />
        <CommonField
          name="Tag"
          value={codeValue(
            <HeroTagIcon
              fontSize="small"
              color="action"
              className="text-base"
            />,
            source_code_version.sourceCodeVersion,
          )}
          span="half"
        />
      </SidebarSection>

      <SidebarDetailsSection entity={source_code_version} />
    </EntitySidebar>
  );
};
