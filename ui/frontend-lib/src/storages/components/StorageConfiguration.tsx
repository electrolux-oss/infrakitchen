import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
  getTextValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { StorageResponse } from "../types";

export interface StorageConfigurationProps {
  storage: StorageResponse;
}

export const StorageConfiguration = ({
  storage,
}: StorageConfigurationProps) => {
  return (
    <PropertyCollapseCard
      title={"Storage Configuration"}
      expanded={true}
      id="storage-config"
    >
      <OverviewCard>
        <CommonField
          name={"Integration"}
          value={
            <GetReferenceUrlValue
              {...storage.integration}
              urlProvider={storage.integration.integration_provider}
            />
          }
        />
        <CommonField
          name={"Storage Provider"}
          value={getProviderValue(storage.storage_provider)}
        />
        <CommonField
          name={"Storage Type"}
          value={getTextValue(storage.storage_type)}
        />
        {Object.entries(storage.configuration).map(([k, v]) => {
          return (
            <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />
          );
        })}
      </OverviewCard>
    </PropertyCollapseCard>
  );
};
