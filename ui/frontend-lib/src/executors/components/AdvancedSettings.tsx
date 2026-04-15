import { Box } from "@mui/material";

import {
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
          ) : null
        }
      />
      <CommonField
        name={"Integrations"}
        value={
          executor.integration_ids.length > 0 ? (
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
          ) : null
        }
        size={6}
      />
      <CommonField
        name={"Secrets"}
        value={
          executor.secret_ids.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {executor.secret_ids.map((parent) => (
                <span key={parent.id}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          ) : null
        }
        size={6}
      />

      <CommonField
        name={"Storage Path"}
        value={executor.storage_path}
        size={12}
      />
      <CommonField
        name={"Command arguments"}
        value={executor.command_args}
        size={12}
      />
    </OverviewCard>
  );
};
