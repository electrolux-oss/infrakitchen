import { formatLabel } from "../../common";
import {
  CommonField,
  getProviderValue,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { StorageResponse } from "../types";

interface StorageConfigurationProps {
  storage: StorageResponse;
}

export const StorageConfiguration = ({
  storage,
}: StorageConfigurationProps) => {
  return (
    <OverviewCard name="Storage Configuration">
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
      <CommonField name={"Storage Type"} value={storage.storage_type} />
      {Object.entries(storage.configuration).map(([k, v]) => {
        return <CommonField key={`${k}${v}`} name={formatLabel(k)} value={v} />;
      })}
    </OverviewCard>
  );
};
