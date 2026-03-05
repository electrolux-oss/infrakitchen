import { useNavigate } from "react-router";

import { Box, Chip } from "@mui/material";

import { BlueprintResponse } from "../../blueprints/types";
import {
  CommonField,
  GetEntityLink,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import StatusChip from "../../common/StatusChip";
import { WorkflowResponse } from "../types";

interface WorkflowOverviewProps {
  blueprint: BlueprintResponse | null;
}

export const WorkflowOverview = ({ blueprint }: WorkflowOverviewProps) => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;
  const workflow = entity as WorkflowResponse;

  return (
    <OverviewCard
      name={`Workflow ${workflow.id.slice(0, 8)}…`}
      description={
        blueprint
          ? `Blueprint: ${blueprint.name}`
          : `Blueprint: ${workflow.blueprint_id.slice(0, 8)}…`
      }
    >
      <CommonField
        name="Status"
        value={<StatusChip status={workflow.status} />}
        size={4}
      />

      <CommonField
        name="Blueprint"
        value={
          blueprint ? (
            <GetEntityLink
              id={workflow.blueprint_id}
              _entity_name="blueprint"
              name={blueprint.name}
            />
          ) : (
            workflow.blueprint_id.slice(0, 8) + "…"
          )
        }
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

      {workflow.integration_ids.length > 0 && (
        <CommonField
          name="Integrations"
          size={6}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {workflow.integration_ids.map((id) => (
                <GetReferenceUrlValue
                  key={id}
                  id={id}
                  _entity_name="integration"
                  identifier={id.slice(0, 8) + "…"}
                />
              ))}
            </Box>
          }
        />
      )}

      {workflow.secret_ids.length > 0 && (
        <CommonField
          name="Secrets"
          size={6}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {workflow.secret_ids.map((id) => (
                <GetReferenceUrlValue
                  key={id}
                  id={id}
                  _entity_name="secret"
                  identifier={id.slice(0, 8) + "…"}
                />
              ))}
            </Box>
          }
        />
      )}

      {blueprint && blueprint.templates.length > 0 && (
        <CommonField
          name="Templates"
          size={12}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {blueprint.templates.map((t) => (
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
