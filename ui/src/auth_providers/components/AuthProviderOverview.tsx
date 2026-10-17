import { OverviewCard } from "../../common/components/cards/OverviewCard";
import { BooleanInlineField } from "../../common/components/editors/BooleanInlineField";
import { EditableDescriptionField } from "../../common/components/editors/EditableDescriptionField";
import { EditableNameField } from "../../common/components/editors/EditableNameField";
import { EditableTagsField } from "../../common/components/editors/EditableTagsField";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { PlaceholderText } from "../../common/components/fields/PlaceholderDescription";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Labels } from "../../common/components/labels/Labels";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { useEntityFieldSaver } from "../../common/hooks/useEntityFieldSaver";
import { GqlAuthProvider } from "../graphql";
import {
  AuthProviderUpdateFieldInput,
  UPDATE_AUTH_PROVIDER_MUTATION,
} from "../graphql/mutations";

export interface AuthProviderAboutProps {
  authProvider: GqlAuthProvider;
}

export const AuthProviderOverview = ({
  authProvider,
}: AuthProviderAboutProps) => {
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:auth_provider", "write");

  const saveField = useEntityFieldSaver<AuthProviderUpdateFieldInput>(
    UPDATE_AUTH_PROVIDER_MUTATION,
    authProvider.id,
    "Auth Provider",
  );

  return (
    <OverviewCard name={authProvider.name}>
      <EditableNameField
        value={authProvider.name}
        canEdit={canEdit}
        onSave={(value) => saveField({ name: value })}
        span="half"
      />
      <CommonField
        name={"Auth Provider Type"}
        value={getProviderValue(authProvider.authProvider)}
        span="half"
      />{" "}
      <EditableDescriptionField
        value={authProvider.description}
        canEdit={canEdit}
        onSave={(value) => saveField({ description: value })}
      />
      <BooleanInlineField
        name={"Enabled"}
        canEdit={canEdit}
        value={authProvider.enabled}
        ariaLabel="Edit enabled status"
        onSave={(value) => saveField({ enabled: value })}
        span="half"
      />{" "}
      <EditableTagsField
        name="Filter By Domain"
        value={authProvider.filterByDomain || []}
        canEdit={canEdit}
        onSave={(value) => saveField({ filterByDomain: value })}
        helperText="Add domains and press Enter"
        span="half"
        display={
          authProvider.filterByDomain &&
          authProvider.filterByDomain.length > 0 ? (
            <Labels labels={authProvider.filterByDomain} />
          ) : (
            <PlaceholderText />
          )
        }
      />
      <CommonField
        name={"Created"}
        value={<RelativeTime date={authProvider.createdAt} />}
        span="half"
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={authProvider.updatedAt} />}
        span="half"
      />
    </OverviewCard>
  );
};
