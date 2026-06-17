import { useNavigate } from "react-router";

import { Box, Chip } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
import { Duration } from "../../common/components/Duration";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import StatusChip from "../../common/StatusChip";
import { WorkflowResponse } from "../types";

export const WorkflowOverview = () => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;
  const workflow = entity as WorkflowResponse;

  // Derive unique templates from steps
  const templates = workflow.steps
    .map((s) => s.template)
    .filter(
      (t, i, arr): t is NonNullable<typeof t> =>
        t !== null && arr.findIndex((x) => x?.id === t.id) === i,
    );

  return (
    <OverviewCard name={`Workflow ${workflow.id.slice(0, 8)}…`} description="">
      <CommonField
        name="Status"
        value={<StatusChip status={workflow.status} />}
        size={4}
      />

      <CommonField
        name="Action"
        value={workflow.action.toUpperCase()}
        size={4}
      />

      <CommonField
        name="Created"
        value={
          <RelativeTime date={workflow.createdAt} user={workflow.creator} />
        }
        size={4}
      />

      {workflow.startedAt && (
        <CommonField
          name="Started"
          value={<RelativeTime date={workflow.startedAt} />}
          size={4}
        />
      )}

      {workflow.completedAt && (
        <CommonField
          name="Completed"
          value={<RelativeTime date={workflow.completedAt} />}
          size={4}
        />
      )}
      {workflow.startedAt && workflow.completedAt && (
        <CommonField
          name="Duration"
          value={
            <Duration start={workflow.startedAt} end={workflow.completedAt} />
          }
          size={4}
        />
      )}

      {workflow.errorMessage && (
        <CommonField
          name="Error"
          value={
            <Chip
              label={workflow.errorMessage}
              color="error"
              size="small"
              variant="outlined"
            />
          }
          size={12}
        />
      )}

      {templates.length > 0 && (
        <CommonField
          name="Templates"
          size={12}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {templates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`${linkPrefix}templates/${t.id}`)}
                />
              ))}
            </Box>
          }
        />
      )}
    </OverviewCard>
  );
};
