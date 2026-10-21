import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { SidebarDetailsSection } from "../../common/components/cards/SidebarDetailsSection";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  EntityReference,
} from "../../common/components/fields/CommonField";
import { Label, StatusLabel } from "../../common/components/labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { HeroAdjustmentsHorizontalIcon } from "../../icons";
import { GqlBlueprint, UPDATE_BLUEPRINT_MUTATION } from "../graphql";
import { BlueprintUpdateFieldInput } from "../graphql/mutations";

export interface BlueprintSidebarProps {
  blueprint: GqlBlueprint;
}

/**
 * Right context sidebar for the blueprint detail page: groups the
 * blueprint's description, status, building blocks and history so the main
 * column can focus on its wiring and workflows.
 */
export const BlueprintSidebar = ({ blueprint }: BlueprintSidebarProps) => {
  const { checkActionPermission } = usePermissionProvider();

  const canEdit = checkActionPermission("api:blueprint", "write");

  const saveField = useEntityFieldSaver<BlueprintUpdateFieldInput>(
    UPDATE_BLUEPRINT_MUTATION,
    blueprint.id,
    "Blueprint",
  );

  const externalTemplates = blueprint.externalTemplates || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  return (
    <EntitySidebar ariaLabel="Blueprint details">
      <SidebarSection title="About">
        <EditableNameField
          value={blueprint.name}
          canEdit={canEdit}
          onSave={(value) => saveField({ name: value })}
        />
        <EditableDescriptionField
          value={blueprint.description}
          canEdit={canEdit}
          onSave={(value) => saveField({ description: value })}
        />
        <CommonField
          name="Status"
          value={<StatusLabel status={blueprint.status} />}
          span="full"
        />
        <EditableTagsField
          value={blueprint.labels || []}
          canEdit={canEdit}
          onSave={(value) => saveField({ labels: value })}
        />
      </SidebarSection>

      <SidebarSection title="Templates" count={blueprint.templates.length}>
        <div className="col-span-full">
          <div className="flex flex-wrap gap-2">
            {blueprint.templates.map((t) => (
              <EntityReference key={t.id} {...t} />
            ))}
          </div>
        </div>
      </SidebarSection>

      {externalTemplates.length > 0 && (
        <SidebarSection
          title="Input Templates"
          count={externalTemplates.length}
        >
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2">
              {externalTemplates.map((t) => (
                <EntityReference key={t.id} {...t} tone="warning" />
              ))}
            </div>
          </div>
        </SidebarSection>
      )}

      {constants.length > 0 && (
        <SidebarSection title="Constants" count={constants.length}>
          <div className="col-span-full">
            <div className="flex flex-wrap gap-2">
              {constants.map((c) => (
                <Label
                  key={c.id}
                  label={c.name}
                  tone="secondary"
                  icon={<HeroAdjustmentsHorizontalIcon />}
                />
              ))}
            </div>
          </div>
        </SidebarSection>
      )}

      <SidebarDetailsSection entity={blueprint} />
    </EntitySidebar>
  );
};
