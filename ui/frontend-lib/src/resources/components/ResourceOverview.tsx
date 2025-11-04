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
import { ResourceResponse } from "../types";

export interface ResourceAboutProps {
  resource: ResourceResponse;
}

export const ResourceOverview = ({ resource }: ResourceAboutProps) => {
  return (
    <OverviewCard name={resource.name} description={resource.description}>
      <CommonField
        name={"Template"}
        value={getTextValue(resource.template.name)}
      />
      <CommonField
        name={"State"}
        value={<StatusChip status={resource.status} state={resource.state} />}
      />
      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={resource.created_at} user={resource.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={resource.updated_at} />}
      />
      <CommonField
        name={"Labels"}
        value={getLabels(resource.labels)}
        size={12}
      />
      {resource.parents.length > 0 && (
        <CommonField
          name={"Parents"}
          value={
            <Box display="flex" gap={1}>
              {resource.parents.map((parent) => (
                <span key={parent.id}>
                  <GetReferenceUrlValue {...parent} />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}
      {resource.children.length > 0 && (
        <CommonField
          name={"Children"}
          value={
            <Box display="flex" gap={1}>
              {resource.children.map((child) => (
                <span key={child.id}>
                  <GetReferenceUrlValue {...child} />
                </span>
              ))}
            </Box>
          }
          size={6}
        />
      )}
    </OverviewCard>
  );
};
