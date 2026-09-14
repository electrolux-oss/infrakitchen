import { Entity, formatLabel } from "../../common";
import { BaseCard } from "../../common/components/cards/BaseCard";
import {
  CommonField,
  getProviderValue,
} from "../../common/components/fields/CommonField";
import { GqlStorage } from "../graphql";

export interface StorageConfigurationProps {
  storage: GqlStorage;
}

export const StorageConfiguration = ({
  storage,
}: StorageConfigurationProps) => {
  return (
    <BaseCard name="Storage Configuration">
      {storage.integration && (
        <CommonField
          name={"Integration"}
          value={<Entity entity={storage.integration} providerIconSize={24} />}
        />
      )}
      <CommonField
        name={"Storage Provider"}
        value={getProviderValue(storage.storageProvider)}
      />
      <CommonField name={"Storage Type"} value={storage.storageType} />
      {Object.entries(storage.configuration || {}).map(([k, v]) => {
        return <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />;
      })}
    </BaseCard>
  );
};
