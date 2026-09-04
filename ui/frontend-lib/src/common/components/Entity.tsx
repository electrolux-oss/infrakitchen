import { Box } from "@mui/material";

import { GetEntityLink } from "./CommonField";
import { Label } from "./Label";

export interface EntityRecord {
  id?: string;
  name?: string;
  entityName?: string;
  template?: { name?: string } | null;
}

export interface EntityProps {
  entity?: EntityRecord | null;
  fallbackName?: string;
}

export const Entity = ({
  entity,
  fallbackName = "Unknown Entity",
}: EntityProps) => {
  if (!entity) {
    return <>{fallbackName}</>;
  }
  const tagLabel = entity.template?.name || entity.entityName;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        minWidth: 0,
      }}
    >
      {entity.id ? (
        <GetEntityLink
          id={entity.id}
          entityName={entity.entityName}
          name={entity.name || fallbackName}
        />
      ) : (
        <>{entity.name || fallbackName}</>
      )}
      {tagLabel && <Label label={tagLabel} />}
    </Box>
  );
};
