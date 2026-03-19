import { Box, Divider } from "@mui/material";

import {
  getLabels,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { getProviderDisplayName } from "../../common/utils";
import { TemplateResponse } from "../types";

export interface TemplateAboutProps {
  template: TemplateResponse;
}

export const TemplateOverview = ({ template }: TemplateAboutProps) => {
  return (
    <OverviewCard
      name={template.name}
      description={template.description || "No description"}
      chip={template.abstract ? "Abstract" : undefined}
    >
      <CommonField
        name={"Status"}
        value={<StatusChip status={template.status} />}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={template.created_at} user={template.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={template.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={getLabels(template.labels)}
        size={12}
      />

      {template.parents.length > 0 && (
        <CommonField
          name={"Parents"}
          value={
            <Box display="flex" gap={1}>
              {template.parents.map((parent, idx) => (
                <span key={parent.id || idx}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}
      {template.children.length > 0 && (
        <CommonField
          name={"Children"}
          value={
            <Box display="flex" gap={1}>
              {template.children.map((child, idx) => (
                <span key={child.id || idx}>
                  <GetReferenceUrlValue {...child} />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}

      {template.cloud_resource_types.length > 0 && (
        <>
          <Box sx={{ width: "100%", my: 1 }}>
            <Divider />
          </Box>
          <CommonField
            name={"Cloud Resource Types"}
            value={
              <Box>
                {template.cloud_resource_types.map((type) => (
                  <Box
                    key={type}
                    component="span"
                    sx={{
                      display: "inline-block",
                      backgroundColor: "primary.dark",
                      color: "primary.contrastText",
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      mr: 0.5,
                      mb: 0.5,
                      fontSize: "0.875rem",
                    }}
                  >
                    {type}
                  </Box>
                ))}
              </Box>
            }
            size={6}
          />
        </>
      )}
      {template.configuration?.one_resource_per_integration?.length > 0 && (
        <CommonField
          name={"Integration Providers for One Resource Per Integration"}
          value={
            <Box>
              {template.configuration.one_resource_per_integration.map(
                (provider) => (
                  <Box
                    key={provider}
                    component="span"
                    sx={{
                      display: "inline-block",
                      backgroundColor: "primary.dark",
                      color: "primary.contrastText",
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      mr: 0.5,
                      mb: 0.5,
                      fontSize: "0.875rem",
                    }}
                  >
                    {getProviderDisplayName(provider)}
                  </Box>
                ),
              )}
            </Box>
          }
          size={6}
        />
      )}

      {template.configuration?.allowed_provider_integration_types?.length >
        0 && (
        <CommonField
          name={"Allowed Integration Providers"}
          value={
            <Box>
              {template.configuration.allowed_provider_integration_types.map(
                (provider) => (
                  <Box
                    key={provider}
                    component="span"
                    sx={{
                      display: "inline-block",
                      backgroundColor: "primary.dark",
                      color: "primary.contrastText",
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      mr: 0.5,
                      mb: 0.5,
                      fontSize: "0.875rem",
                    }}
                  >
                    {getProviderDisplayName(provider)}
                  </Box>
                ),
              )}
            </Box>
          }
          size={6}
        />
      )}
      {template.configuration?.naming_convention && (
        <CommonField
          name={"Naming Convention"}
          value={
            <Box component="span" sx={{ fontStyle: "italic", mr: 1 }}>
              {template.configuration.naming_convention}
            </Box>
          }
          size={6}
        />
      )}
    </OverviewCard>
  );
};
