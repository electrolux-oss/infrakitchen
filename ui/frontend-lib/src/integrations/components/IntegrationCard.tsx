import { useNavigate } from "react-router";

import { Box, Typography } from "@mui/material";

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
            <StatusChip status={integration.status} compact />
          </Box>
        </Box>
      }
      labels={integration.labels}
      description={integration.description}
      metadata={[
        {
          label: "Created",
          value: getDateValue(integration.createdAt),
        },
        {
          label: "Last Updated",
          value: getDateValue(integration.updatedAt),
        },
        {
          label: "Status",
          value: <StatusChip status={integration.status} />,
        },
        {
          label: "Revision Number",
          value: integration.revisionNumber.toString(),
        },
      ]}
      onClick={handleLink}
    />
  );
};

export { IntegrationCard };
