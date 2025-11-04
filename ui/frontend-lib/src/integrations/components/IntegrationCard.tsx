import { useNavigate } from "react-router";

import { Edit } from "@mui/icons-material";
import { Box, IconButton, Typography } from "@mui/material";

import { useConfig } from "../../common";
import { getDateValue } from "../../common/components/CommonField";
import ExpandableCard from "../../common/components/ExpandableCard";
import StatusChip from "../../common/StatusChip";
import { IntegrationResponse, Provider } from "../types";

interface IntegrationItemProps {
  integration: IntegrationResponse;
  provider: Provider;
}

const IntegrationCard = ({ integration, provider }: IntegrationItemProps) => {
  const IconComponent = provider.icon;
  const navigate = useNavigate();

  const { linkPrefix } = useConfig();

  const handleLink = () => {
    navigate(`${linkPrefix}integrations/${provider.slug}/${integration.id}`);
  };
  const handleEdit = () => {
    navigate(`${linkPrefix}integrations/${integration.id}/edit`);
  };

  return (
    <ExpandableCard
      id={`integration-card`}
      icon={<IconComponent width="40" height="40" />}
      title={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body1" sx={{ minWidth: 200, fontWeight: 600 }}>
            {integration.name}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <StatusChip status={integration.status} />
          </Box>
        </Box>
      }
      labels={integration.labels}
      description={integration.description}
      metadata={[
        {
          label: "Created At",
          value: getDateValue(integration.created_at),
        },
        {
          label: "Updated At",
          value: getDateValue(integration.updated_at),
        },
        {
          label: "Status",
          value: <StatusChip status={integration.status} />,
        },
        {
          label: "Revision Number",
          value: integration.revision_number.toString(),
        },
      ]}
      onClick={handleLink}
      actions={
        <>
          <IconButton onClick={handleEdit} aria-label="Edit Integration">
            <Edit />
          </IconButton>
        </>
      }
    />
  );
};

export { IntegrationCard };
