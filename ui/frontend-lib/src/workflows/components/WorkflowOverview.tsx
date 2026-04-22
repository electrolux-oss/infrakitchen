import { useNavigate } from "react-router";

import { Box, Chip } from "@mui/material";

import { CommonField } from "../../common/components/CommonField";
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
        name="Created"
        value={
          <RelativeTime date={workflow.created_at} user={workflow.creator} />
        }
        size={4}
      />

      {workflow.started_at && (
        <CommonField
          name="Started"
          value={<RelativeTime date={workflow.started_at} />}
          size={4}
        />
      )}

      {workflow.completed_at && (
        <CommonField
          name="Completed"
          value={<RelativeTime date={workflow.completed_at} />}
          size={4}
        />
      )}

      {workflow.error_message && (
        <CommonField
          name="Error"
          value={
            <Chip
              label={workflow.error_message}
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
