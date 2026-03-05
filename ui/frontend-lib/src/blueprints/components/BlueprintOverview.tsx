import { useNavigate } from "react-router";

import StorageIcon from "@mui/icons-material/Storage";
import TuneIcon from "@mui/icons-material/Tune";
import { Box, Chip } from "@mui/material";

import {
  CommonField,
  getLabels,
  GetEntityLink,
} from "../../common/components/CommonField";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context/ConfigContext";
import { useEntityProvider } from "../../common/context/EntityContext";
import StatusChip from "../../common/StatusChip";
import { BlueprintResponse } from "../types";

export const BlueprintOverview = () => {
  const { entity } = useEntityProvider();
  const { linkPrefix } = useConfig();
  const navigate = useNavigate();

  if (!entity) return null;
  const blueprint = entity as BlueprintResponse;

  const externalTemplates =
    (blueprint.configuration?.external_templates as Array<{
      id: string;
      name: string;
    }>) || [];

  const constants =
    (blueprint.configuration?.constants as Array<{
      id: string;
      name: string;
    }>) || [];

  return (
    <OverviewCard name={blueprint.name} description={blueprint.description}>
      <CommonField
        name="Status"
        value={<StatusChip status={blueprint.status} />}
        size={4}
      />

      <CommonField
        name="Templates"
        value={
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {blueprint.templates.map((t) => (
              <GetEntityLink key={t.id} {...t} />
            ))}
          </Box>
        }
        size={4}
      />

      <CommonField
        name="Last Updated"
        value={<RelativeTime date={blueprint.updated_at} />}
        size={4}
      />

      <CommonField
        name="Labels"
        value={getLabels(blueprint.labels)}
        size={12}
      />

      {externalTemplates.length > 0 && (
        <CommonField
          name="Input Templates"
          size={6}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {externalTemplates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  size="small"
                  variant="outlined"
                  color="warning"
                  icon={<StorageIcon />}
                  onClick={() => navigate(`${linkPrefix}templates/${t.id}`)}
                />
              ))}
            </Box>
          }
        />
      )}

      {constants.length > 0 && (
        <CommonField
          name="Constants"
          size={6}
          value={
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {constants.map((c) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  size="small"
                  variant="outlined"
                  color="secondary"
                  icon={<TuneIcon />}
                />
              ))}
            </Box>
          }
        />
      )}
    </OverviewCard>
  );
};
