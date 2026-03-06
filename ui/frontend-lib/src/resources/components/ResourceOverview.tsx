import { Box } from "@mui/material";

import {
  getLabels,
  CommonField,
  GetReferenceUrlValue,
  GetEntityLink,
} from "../../common/components/CommonField";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import StatusChip from "../../common/StatusChip";
import { SourceCodeVersionLink } from "../../source_codes/components/SourceCodeVersionLink";
import { ResourceResponse } from "../types";

export interface ResourceAboutProps {
  resource: ResourceResponse;
}

export const ResourceOverview = ({ resource }: ResourceAboutProps) => {
  return (
    <OverviewCard
      name={resource.name}
      description={resource.description}
      actions={
        <FavoriteButton
          componentId={String(resource.id)}
          componentType="resource"
          ariaLabel="Add resource to favorites"
        />
      }
    >
      <CommonField
        name="State"
        value={<StatusChip status={resource.status} state={resource.state} />}
        size={4}
      />

      <CommonField
        name="Template Version"
        value={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <GetEntityLink {...resource.template} />
            {"/"}
            <SourceCodeVersionLink
              source_code_version={resource.source_code_version}
              name={
                resource.source_code_version?.source_code_version ||
                resource.source_code_version?.source_code_branch
              }
            />
          </Box>
        }
        size={4}
      />

      <CommonField name="Revision" value={resource.revision_number} size={4} />

      <CommonField
        name="Created"
        value={
          <RelativeTime date={resource.created_at} user={resource.creator} />
        }
        size={4}
      />
      <CommonField
        name="Last Updated"
        value={<RelativeTime date={resource.updated_at} />}
        size={4}
      />

      <CommonField name="Labels" value={getLabels(resource.labels)} size={12} />

      {resource.parents.length > 0 && (
        <CommonField
          name={`Parents (${resource.parents.length})`}
          size={6}
          value={
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                maxHeight: 150,
                overflowY: "auto",
                mt: 1,
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              })}
            >
              {resource.parents.map((parent) => (
                <GetReferenceUrlValue
                  key={parent.id}
                  {...parent}
                  display_name={`${parent.template.name} (${parent.name})`}
                />
              ))}
            </Box>
          }
        />
      )}
      {resource.children.length > 0 && (
        <CommonField
          name={`Children (${resource.children.length})`}
          size={6}
          value={
            <Box
              sx={(theme) => ({
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                maxHeight: 150,
                overflowY: "auto",
                mt: 1,
                p: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
              })}
            >
              {resource.children.map((child) => (
                <GetReferenceUrlValue
                  key={child.id}
                  {...child}
                  display_name={`${child.template.name} (${child.name})`}
                />
              ))}
            </Box>
          }
        />
      )}
    </OverviewCard>
  );
};
