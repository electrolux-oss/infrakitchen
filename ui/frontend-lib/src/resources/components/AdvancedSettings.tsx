import { Grid } from "@mui/material";

import {
  getTextValue,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { PropertyCollapseCard } from "../../common/components/PropertyCollapseCard";
import { ResourceResponse } from "../types";

export interface AdvancedSettingsProps {
  resource: ResourceResponse;
}

export const AdvancedSettings = ({ resource }: AdvancedSettingsProps) => {
  return (
    <PropertyCollapseCard
      title="Advanced Settings"
      id="resource-advanced-settings"
    >
      <Grid container spacing={2}>
        <CommonField name={"Revision"} value={resource.revision_number} />
        {resource.abstract === false && (
          <>
            <CommonField
              name={"Storage"}
              value={
                resource.storage ? (
                  <GetReferenceUrlValue {...resource.storage} />
                ) : (
                  "N/A"
                )
              }
            />
            <CommonField
              name={"Storage Path"}
              value={getTextValue(resource.storage_path || "N/A")}
              size={12}
            />
          </>
        )}
      </Grid>
    </PropertyCollapseCard>
  );
};
