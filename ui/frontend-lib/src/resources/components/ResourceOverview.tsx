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
          name={`Parents (${resource.parents.length})`}
          value={
            <Box
              gap={1}
              maxHeight={150}
              sx={{ overflowY: "auto", p: 1, border: "1px solid #eee" }}
            >
              {resource.parents.map((parent) => {
                const display_name = `${parent.template.name} (${parent.name})`;
                return (
                  <Box key={parent.id} sx={{ flexShrink: 0 }}>
                    <GetReferenceUrlValue
                      {...parent}
                      display_name={display_name}
                    />
                  </Box>
                );
              })}
            </Box>
          }
          size={6}
        />
      )}
      {resource.children.length > 0 && (
        <CommonField
          name={`Children (${resource.children.length})`}
          value={
            <Box
              gap={1}
              maxHeight={150}
              sx={{ overflowY: "auto", p: 1, border: "1px solid #eee" }}
            >
              {resource.children.map((child) => {
                const display_name = `${child.template.name} (${child.name})`;
                return (
                  <Box key={child.id} sx={{ flexShrink: 0 }}>
                    <GetReferenceUrlValue
                      {...child}
                      display_name={display_name}
                    />
                  </Box>
                );
              })}
            </Box>
          }
          size={6}
        />
      )}
    </OverviewCard>
  );
};
