import { useNavigate } from "react-router";

import { Box, Chip, Grid } from "@mui/material";

import {
  EntitySidebar,
  SidebarSection,
} from "../../common/components/cards/EntitySidebar";
import { Entity } from "../../common/components/entities/Entity";
import { CommonField } from "../../common/components/fields/CommonField";
import { Duration } from "../../common/components/fields/Duration";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import StatusChip from "../../common/StatusChip";
import { GqlWorkflow } from "../graphql";

export interface WorkflowSidebarProps {
  workflow: GqlWorkflow;
}

/**
 * GitHub-style right sidebar for the workflow detail page: groups the
 * workflow's status, timing, templates and history so the main column can
 * focus on its steps, variables and logs.
 */
export const WorkflowSidebar = ({ workflow }: WorkflowSidebarProps) => {
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  // Derive unique templates from steps
  const templates = workflow.steps
    .map((s) => s.template)
    .filter(
      (t, i, arr): t is NonNullable<typeof t> =>
        t !== null && arr.findIndex((x) => x?.id === t.id) === i,
    );

  return (
    <EntitySidebar ariaLabel="Workflow details">
      <SidebarSection title="Status">
        <Grid size={12}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <StatusChip status={workflow.status} />
            <Chip label={workflow.action.toUpperCase()} variant="outlined" />
          </Box>
        </Grid>
        {workflow.errorMessage && (
          <CommonField
            name="Error"
            value={
              <Chip
                label={workflow.errorMessage}
                color="error"
                size="small"
                variant="outlined"
                sx={{
                  height: "auto",
                  "& .MuiChip-label": { whiteSpace: "normal", py: 0.5 },
                }}
              />
            }
            size={12}
          />
        )}
      </SidebarSection>

      {(workflow.startedAt || workflow.completedAt) && (
        <SidebarSection title="Timing">
          {workflow.startedAt && (
            <CommonField
              name="Started"
              value={<RelativeTime date={workflow.startedAt} />}
              size={6}
            />
          )}
          {workflow.completedAt && (
            <CommonField
              name="Completed"
              value={<RelativeTime date={workflow.completedAt} />}
              size={6}
            />
          )}
          {workflow.startedAt && workflow.completedAt && (
            <CommonField
              name="Duration"
              value={
                <Duration
                  start={workflow.startedAt}
                  end={workflow.completedAt}
                />
              }
              size={12}
            />
          )}
        </SidebarSection>
      )}

      {templates.length > 0 && (
        <SidebarSection title="Templates" count={templates.length}>
          <Grid size={12}>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {templates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  variant="outlined"
                  onClick={() => navigate(`${linkPrefix}templates/${t.id}`)}
                />
              ))}
            </Box>
          </Grid>
        </SidebarSection>
      )}

      <SidebarSection title="Details">
        <CommonField
          name="Created by"
          value={
            workflow.creator ? (
              <Entity entity={{ ...workflow.creator, entityType: "user" }} />
            ) : null
          }
          size={12}
        />
        <CommonField
          name="Created"
          value={<RelativeTime date={workflow.createdAt} />}
          size={12}
        />
      </SidebarSection>
    </EntitySidebar>
  );
};
