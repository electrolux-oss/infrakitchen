import { Box } from "@mui/material";

import {
  getTextValue,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { ExecutorResponse } from "../types";

export interface AdvancedSettingsProps {
  executor: ExecutorResponse;
}

export const AdvancedSettings = ({ executor }: AdvancedSettingsProps) => {
  return (
    <OverviewCard>
      <CommonField name={"Revision"} value={executor.revision_number} />
      <CommonField
        name={"Storage"}
        value={
          executor.storage ? (
            <GetReferenceUrlValue {...executor.storage} />
          ) : (
            "N/A"
          )
        }
      />
      {executor.integration_ids.length > 0 && (
        <CommonField
          name={"Integrations"}
          value={
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {executor.integration_ids.map((parent) => (
                <span key={parent.id}>
                  <GetReferenceUrlValue
                    {...parent}
                    urlProvider={parent.integration_provider}
                  />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}
      {executor.secret_ids.length > 0 && (
        <CommonField
          name={"Secrets"}
          value={
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {executor.secret_ids.map((parent) => (
                <span key={parent.id}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}

      <CommonField
        name={"Storage Path"}
        value={getTextValue(executor.storage_path || "N/A")}
        size={12}
      />
      <CommonField
        name={"Command arguments"}
        value={getTextValue(executor.command_args || "N/A")}
        size={12}
      />
    </OverviewCard>
  );
};
