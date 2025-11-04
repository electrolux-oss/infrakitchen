import { Box } from "@mui/material";

import {
  getTextValue,
  getLabels,
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { TemplateResponse } from "../types";

export interface TemplateAboutProps {
  template: TemplateResponse;
}

export const TemplateOverview = ({ template }: TemplateAboutProps) => {
  return (
    <OverviewCard
      name={template.name}
      description={template.description || "No description"}
    >
      <CommonField
        name={"Status"}
        value={<StatusChip status={template.status} />}
      />
      <CommonField name={"Abstract"} value={getTextValue(template.abstract)} />
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
          size={12}
        />
      )}
    </OverviewCard>
  );
};
