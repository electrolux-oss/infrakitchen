import { Box, List, ListItem, ListItemText, Typography } from "@mui/material";

import { GetEntityLink } from "../../common/components/CommonField";
import { PropertyCard } from "../../common/components/PropertyCard";
import { BatchOperation } from "../types";

interface BatchOperationErrorEntitiesProps {
  batchOperation: BatchOperation;
}

export const BatchOperationErrorEntities = ({
  batchOperation,
}: BatchOperationErrorEntitiesProps) => {
  const errorEntities = batchOperation.error_entity_ids || {};
  const errorEntries = Object.entries(errorEntities);

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <PropertyCard
      title={`Errors (${errorEntries.length})`}
      subtitle="Entities that failed to process"
    >
      <Box sx={{ width: "100%" }}>
        <List dense>
          {errorEntries.map(([entityId, message]) => (
            <ListItem key={entityId} sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    <GetEntityLink
                      id={entityId}
                      _entity_name={batchOperation.entity_type}
                      name={entityId}
                    />
                  </Typography>
                }
                secondary={message}
              />
            </ListItem>
          ))}
        </List>
      </Box>
    </PropertyCard>
  );
};
