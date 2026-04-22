import { Box, Divider } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { InlineCode } from "../../common/components/InlineCode";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { getProviderDisplayName } from "../../common/utils";
import { TemplateResponse } from "../types";

interface TemplateAboutProps {
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
        size={6}
      />
      <CommonField
        name={"Naming Convention"}
        value={
          template.configuration?.naming_convention ? (
            <InlineCode>{template.configuration.naming_convention}</InlineCode>
          ) : null
        }
        size={6}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={template.created_at} user={template.creator} />
        }
        size={6}
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={template.updated_at} />}
        size={6}
      />
      <CommonField
        name={"Labels"}
        value={<Labels labels={template.labels} />}
        size={12}
      />

      <Box sx={{ width: "100%", my: 1 }}>
        <Divider />
      </Box>

      <CommonField
        name={"Parents"}
        value={
          template.parents.length > 0 ? (
            <Box display="flex" gap={1}>
              {template.parents.map((parent, idx) => (
                <span key={parent.id || idx}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          ) : null
        }
        size={6}
      />
      <CommonField
        name={"Children"}
        value={
          template.children.length > 0 ? (
            <Box display="flex" gap={1}>
              {template.children.map((child, idx) => (
                <span key={child.id || idx}>
                  <GetReferenceUrlValue {...child} />
                </span>
              ))}
            </Box>
          ) : null
        }
        size={6}
      />

      <CommonField
        name={"Cloud Resource Types"}
        value={
          template.cloud_resource_types.length > 0 ? (
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
          ) : null
        }
        size={6}
      />
      <CommonField
        name={"Integration Providers for One Resource Per Integration"}
        value={
          template.configuration?.one_resource_per_integration?.length > 0 ? (
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
          ) : null
        }
        size={6}
      />

      <CommonField
        name={"Allowed Integration Providers"}
        value={
          template.configuration?.allowed_provider_integration_types?.length >
          0 ? (
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
          ) : null
        }
        size={6}
      />
    </OverviewCard>
  );
};
